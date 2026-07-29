"use client";

import type { ReactNode } from "react";

import { Modal, ModalBody } from "@/components/ui/modal";
import { useRouter } from "@/i18n/navigation";

/**
 * Client shell for the register route-intercept: wraps the shared
 * {@link EventRegisterContent} (passed as `children`, server-rendered) in the
 * house `Modal`. Dismiss pops the intercepted route off history, revealing the
 * event page underneath; a hard load hits the full-page fallback instead.
 *
 * The `.ace-landing` wrapper is required because form / button / iv-* rules
 * live under that scope (see series-flows.css + landing.css), and the @modal
 * slot renders as a sibling of the page — same pattern as the video lightbox
 * portal. `register-modal` keeps the house white dialog and lightens the
 * shared on-dark form markup for contrast.
 */
export function RegisterModal({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <div className="ace-landing register-modal">
      <Modal open onClose={() => router.back()} size="lg">
        <ModalBody>{children}</ModalBody>
      </Modal>
    </div>
  );
}
