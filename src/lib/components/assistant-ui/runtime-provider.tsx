import { AssistantRuntimeProvider } from "@assistant-ui/react";
import type { FC, ReactNode } from "react";

interface AigentisBrowserRuntimeProviderProps {
  children: ReactNode;
}

export const AigentisBrowserRuntimeProvider: FC<AigentisBrowserRuntimeProviderProps> = ({ children }) => {
  // Temporarily render children directly, will integrate full runtime later
  return <>{children}</>;
};
