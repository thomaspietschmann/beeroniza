"use client";

import Modal from "react-bootstrap/Modal";
import { MediaLibrary } from "./MediaLibrary";
import type { MediaFile } from "@/lib/media/client";

interface Props {
  show: boolean;
  onHide: () => void;
  selectedId?: string | null;
  onSelect: (file: MediaFile) => void;
}

// Media library in a modal, used to pick an image for an image placeholder.
export function MediaPickerModal({ show, onHide, selectedId, onSelect }: Props) {
  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title className="h5">Choose an image</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <MediaLibrary
          selectMode
          selectedId={selectedId}
          onSelect={(f) => {
            onSelect(f);
            onHide();
          }}
        />
      </Modal.Body>
    </Modal>
  );
}
