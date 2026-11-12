"use client";

import { useCallback, useRef } from "react";

export function useDashboardDialogs() {
  const addContextDialogRef = useRef<HTMLDialogElement | null>(null);
  const newProjectDialogRef = useRef<HTMLDialogElement | null>(null);
  const editProjectDialogRef = useRef<HTMLDialogElement | null>(null);
  const syncProjectsDialogRef = useRef<HTMLDialogElement | null>(null);
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
  const openSyncProjectsModal = useCallback(
    () => syncProjectsDialogRef.current?.showModal(),
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
    syncProjectsDialogRef,
    editLogoDialogRef,
    checklistDialogRef,
    globalSettingsDialogRef,
    teamRbacDialogRef,
    openAddContextModal,
    openNewProjectModal,
    openEditProjectModal,
    openSyncProjectsModal,
    openEditLogoModal,
    openChecklistModal,
    openGlobalSettingsModal,
    openTeamRbacModal,
  };
}
