import OnlineGameRoomPage from "@/app/components/pages/OnlineGameRoomPage";

export default function OnlineRoomRoute({ params }: { params: { roomId: string } }) {
  return <OnlineGameRoomPage roomId={params.roomId} />;
}
