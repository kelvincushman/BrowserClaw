import { AssistantRuntimeProvider } from "@assistant-ui/react";
import type { FC, ReactNode } from "react";

interface BrowserClawRuntimeProviderProps {
  children: ReactNode;
}

export const BrowserClawRuntimeProvider: FC<BrowserClawRuntimeProviderProps> = ({ children }) => {
  // Temporarily render children directly, will integrate full runtime later
  return <>{children}</>;
};
