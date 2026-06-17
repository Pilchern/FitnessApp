import type { CardioSession, JournalEntry } from "@fitness-app/domain";

export type JournalPageData = {
  entries: JournalEntry[];
  cardioSessions: CardioSession[];
  editingEntry: JournalEntry | null;
  filters: {
    searchTerm: string;
    tag: string;
    startDate: string;
    endDate: string;
  };
  formError?: string;
};

export type JournalActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type JournalFormValues = {
  id?: string;
  entryDate: string;
  title: string;
  body: string;
  tags: string;
  relatedWeekStart: string;
  relatedCardioSessionId: string;
  relatedStrengthSessionId: string;
};
