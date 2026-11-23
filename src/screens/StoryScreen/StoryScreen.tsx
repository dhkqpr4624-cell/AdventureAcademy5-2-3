import type { ScreenId } from "../../app/routes";
import { Chapter3IntroPlayer } from "../../game/chapter3/Chapter3IntroPlayer";

type StoryScreenProps = {
  onNavigate: (screen: ScreenId) => void;
  onStoryStarted: (storyId: string) => void;
  /** Called once when the intro finishes; the caller saves completion and moves to the base camp. */
  onStoryCompleted: (storyId: string) => void;
  playerName: string;
};

/** Story screen of Unit 3: plays the Unit 3 intro (작전본부 → 던전 도착). */
export function StoryScreen({ onNavigate, onStoryStarted, onStoryCompleted, playerName }: StoryScreenProps) {
  return (
    <main className="game-screen chapter3-story-screen">
      <Chapter3IntroPlayer playerName={playerName} onNavigate={onNavigate} onStarted={onStoryStarted} onCompleted={onStoryCompleted} />
      <button type="button" className="chapter3-title-return" onClick={() => onNavigate("title")}>처음 화면</button>
    </main>
  );
}
