"use client";

import type { ReactNode } from "react";

import { Modal, ModalBody } from "@/components/ui/modal";
import { useRouter } from "@/i18n/navigation";

/**
 * Client shell for the register route-intercept: wraps the shared
 * {@link EventRegisterContent} (passed as `children`, server-rendered) in the
 * house `Modal`. Dismiss pops the intercepted route off history, revealing the
 * event page underneath; a hard load hits the full-page fallback instead.
 */
export function RegisterModal({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <Modal open onClose={() => router.back()} size="lg">
      <ModalBody>{children}</ModalBody>
    </Modal>
  );
}
