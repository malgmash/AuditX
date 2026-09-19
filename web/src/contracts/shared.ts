// Types shared by the admin and employee streams. Owned by the auth stream.
// Question answering is grounded by retrieval. See the Retrieval section of SYSTEM-DESIGN.md.

export type AskSource = {
  kind: "RULE" | "POLICY";
  /** Heading shown as the citation. */
  label: string;
  /** Rule id or policy document id. */
  ref: string;
};

/** The asker role and user id are never in the body. The server derives them from the session. */
export type AskRequest = { findingId: string; question: string };

export type AskResponse = {
  answer: string;
  /** Supplied by the service, not written by the model. */
  sources: AskSource[];
  /** True when the model was unreachable and the answer was built from stored text. */
  fallback: boolean;
};
