import { adaptFirm, type DirectoryFirmRow } from "@luxalgo/prop-firm-sim-core/directory";
import type { ChallengeSpecInput } from "@luxalgo/prop-firm-sim-core";

const DIRECTORY_URL = "https://app.luxalgo.com/api/propfirms/list";
const CACHE_MS = 60 * 60_000;

interface CacheEntry {
  at: number;
  challenges: {
    key: string;
    firmId: string;
    firm: string;
    challengeId: string;
    name: string;
    productType: "futures" | "cfd";
    accountSize: number;
    fee: number | null;
    steps: number;
    provenance: string;
    inferredFields: string[];
    spec: ChallengeSpecInput;
  }[];
}

const globalForSim = globalThis as typeof globalThis & { __propSimCache?: CacheEntry };

export async function propSimChallenges(): Promise<CacheEntry["challenges"]> {
  const cached = globalForSim.__propSimCache;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.challenges;
  const response = await fetch(DIRECTORY_URL, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Gagal mengambil direktori prop firm.");
  const payload = (await response.json()) as { data?: { propfirms?: DirectoryFirmRow[] } };
  const firms = payload.data?.propfirms ?? [];
  const challenges: CacheEntry["challenges"] = [];
  for (const firm of firms) {
    for (const adapted of adaptFirm(firm)) {
      challenges.push({
        key: `${adapted.propfirmId}/${adapted.challengeId}`,
        firmId: adapted.propfirmId,
        firm: adapted.firmName,
        challengeId: adapted.challengeId,
        name: adapted.challengeName,
        productType: adapted.productType,
        accountSize: 0,
        fee: null,
        steps: 0,
        provenance: adapted.provenance,
        inferredFields: adapted.inferredFields,
        spec: adapted.spec,
      });
    }
  }
  globalForSim.__propSimCache = { at: Date.now(), challenges };
  return challenges;
}
