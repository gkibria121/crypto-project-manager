"use client";

import { useCallback, useRef } from "react";

export function useDashboardDialogs() {
  const addContextDialogRef = useRef<HTMLDialogElement | null>(null);
  const newProjectDialogRef = useRef<HTMLDialogElement | null>(null);
  const editProjectDialogRef = useRef<HTMLDialogElement | null>(null);
  const editLogoDialogRef = useRef<HTMLDialogElement | null>(null);
  const checklistDialogRef = useRef<HTMLDialogElement | null>(null);
  const globalSettingsDialogRef = useRef<HTMLDialogElement | null>(null);
  const teamRbacDialogRef = useRef<HTMLDialogElement | null>(null);

  const openAddContextModal = useCallback(
    () => addContextDialogRef.current?.showModal(),
    []
  );
  const openNewProjectModal = useCallback(
    () => newProjectDialogRef.current?.showModal(),
    []
  );
  const openEditProjectModal = useCallback(
    () => editProjectDialogRef.current?.showModal(),
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
  const openTeamRbacModal = useCallback(
    () => teamRbacDialogRef.current?.showModal(),
    []
  );

  return {
    addContextDialogRef,
    newProjectDialogRef,
    editProjectDialogRef,
    editLogoDialogRef,
    checklistDialogRef,
    globalSettingsDialogRef,
    teamRbacDialogRef,
    openAddContextModal,
    openNewProjectModal,
    openEditProjectModal,
    openEditLogoModal,
    openChecklistModal,
    openGlobalSettingsModal,
    openTeamRbacModal,
  };
}
