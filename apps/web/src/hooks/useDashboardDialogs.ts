"use client";

import { useCallback, useRef } from "react";

export function useDashboardDialogs() {
  const addContextDialogRef = useRef<HTMLDialogElement | null>(null);
  const newProjectDialogRef = useRef<HTMLDialogElement | null>(null);
  const editLogoDialogRef = useRef<HTMLDialogElement | null>(null);
  const checklistDialogRef = useRef<HTMLDialogElement | null>(null);
  const globalSettingsDialogRef = useRef<HTMLDialogElement | null>(null);

  const openAddContextModal = useCallback(
    () => addContextDialogRef.current?.showModal(),
    []
  );
  const openNewProjectModal = useCallback(
    () => newProjectDialogRef.current?.showModal(),
    []
  );
  const openEditLogoModal = useCallback(
    () => editLogoDialogRef.current?.showModal(),
    []
  );
  const openChecklistModal = useCallback(
    () => checklistDialogRef.current?.showModal(),
    []
  );
  const openGlobalSettingsModal = useCallback(
    () => globalSettingsDialogRef.current?.showModal(),
    []
  );

  return {
    addContextDialogRef,
    newProjectDialogRef,
    editLogoDialogRef,
    checklistDialogRef,
    globalSettingsDialogRef,
    openAddContextModal,
    openNewProjectModal,
    openEditLogoModal,
    openChecklistModal,
    openGlobalSettingsModal,
  };
}
