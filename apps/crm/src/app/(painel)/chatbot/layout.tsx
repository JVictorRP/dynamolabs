import { requireManager } from "@/lib/chatbot";
import { ChatbotTabs } from "./tabs";

export default async function ChatbotLayout({ children }: { children: React.ReactNode }) {
  await requireManager();
  return (
    <div className="space-y-10">
      <ChatbotTabs />
      {children}
    </div>
  );
}
