"use client";

import { useCallback, useRef } from "react";

export function useDashboardDialogs() {
  const addContextDialogRef = useRef<HTMLDialogElement | null>(null);
  const newProjectDialogRef = useRef<HTMLDialogElement | null>(null);
  const editProjectDialogRef = useRef<HTMLDialogElement | null>(null);
  const syncProjectsDialogRef = useRef<HTMLDialogElement | null>(null);
  const bulkDeleteProjectsDialogRef = useRef<HTMLDialogElement | null>(null);
  const editLogoDialogRef = useRef<HTMLDialogElement | null>(null);
  const checklistDialogRef = useRef<HTMLDialogElement | null>(null);
  const globalSettingsDialogRef = useRef<HTMLDialogElement | null>(null);
  const teamRbacDialogRef = useRef<HTMLDialogElement | null>(null);
  const scrapeConfigDialogRef = useRef<HTMLDialogElement | null>(null);
  const scrapedDataDialogRef = useRef<HTMLDialogElement | null>(null);

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
  const openBulkDeleteProjectsModal = useCallback(
    () => bulkDeleteProjectsDialogRef.current?.showModal(),
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
  const openScrapeConfigModal = useCallback(
    () => scrapeConfigDialogRef.current?.showModal(),
    []
  );
  const openScrapedDataModal = useCallback(
    () => scrapedDataDialogRef.current?.showModal(),
    []
  );

  return {
    addContextDialogRef,
    newProjectDialogRef,
    editProjectDialogRef,
    syncProjectsDialogRef,
    bulkDeleteProjectsDialogRef,
    editLogoDialogRef,
    checklistDialogRef,
    globalSettingsDialogRef,
    teamRbacDialogRef,
    scrapeConfigDialogRef,
    scrapedDataDialogRef,
    openAddContextModal,
    openNewProjectModal,
    openEditProjectModal,
    openSyncProjectsModal,
    openBulkDeleteProjectsModal,
    openEditLogoModal,
    openChecklistModal,
    openGlobalSettingsModal,
    openTeamRbacModal,
    openScrapeConfigModal,
    openScrapedDataModal,
  };
}
