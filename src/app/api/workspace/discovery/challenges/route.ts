import { PUBLIC_CHALLENGE_POLICY_VERSION } from "@/domain/moderation";
import { publicChallengeProposalSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { discoveryRepository } from "@/server/dal/discovery-repository";
import { isPublicDiscoveryEnabled, publicContactEmail } from "@/server/moderation-config";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireSession();
    const [challenges, proposals] = await Promise.all([
      discoveryRepository.listPublicChallenges(user.id),
      discoveryRepository.listMyPublicChallenges(user.id),
    ]);
    return Response.json({
      challenges,
      proposals,
      config: {
        configured: isPublicDiscoveryEnabled(),
        contactEmail: publicContactEmail(),
        policyVersion: PUBLIC_CHALLENGE_POLICY_VERSION,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSession();
    const input = await readJson(request, publicChallengeProposalSchema);
    return Response.json(
      { proposal: await discoveryRepository.proposePublicChallenge(user.id, input) },
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
