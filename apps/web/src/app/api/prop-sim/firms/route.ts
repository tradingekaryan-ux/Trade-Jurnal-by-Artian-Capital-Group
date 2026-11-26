import { handler, ok } from "@/server/api";
import { propSimChallenges } from "@/server/prop-sim";

export const GET = handler(async () => {
  const challenges = await propSimChallenges();
  const firms = new Map<string, { id: string; name: string; challenges: typeof challenges }>();
  for (const item of challenges) {
    if (!firms.has(item.firmId))
      firms.set(item.firmId, { id: item.firmId, name: item.firm, challenges: [] });
    firms.get(item.firmId)!.challenges.push(item);
  }
  return ok({ firms: [...firms.values()] });
});
