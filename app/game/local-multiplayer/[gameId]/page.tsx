import LocalMultiplayerGame from "@/app/components/LocalMultiplayerGame";

export default function LocalMultiplayerPage({
  params,
}: {
  params: {
    gameId: string;
  };
}) {
  return <LocalMultiplayerGame gameId={params.gameId} />;
}
