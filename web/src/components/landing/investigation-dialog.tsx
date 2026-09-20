"use client";

import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import styles from "./landing.module.css";

export function InvestigationDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild><Button className={styles.button}>View Investigation <ArrowRight size={16} aria-hidden="true" /></Button></DialogTrigger>
      <DialogContent className={styles.investigationDialog}>
        <DialogHeader>
          <p className={styles.dialogLabel}>Illustrative case · Pending review</p>
          <DialogTitle>Possible duplicate expense</DialogTitle>
          <DialogDescription>$742.00 potential exposure. This example shows how AuditX connects evidence for a reviewer.</DialogDescription>
        </DialogHeader>
        <div><h3>Why it was flagged</h3><ul>{["98% receipt similarity", "Same merchant", "Similar transaction amount", "Submitted 63 days apart"].map(reason => <li key={reason}><Check size={16} aria-hidden="true" />{reason}</li>)}</ul></div>
        <div className={styles.dialogBrief}><h3>AI Investigator</h3><p>These expenses may represent repeated reimbursement of the same purchase. The receipts are highly similar despite being submitted on different dates.</p></div>
        <div><h3>Recommended review steps</h3><p>Compare the original receipts and confirm whether both submissions refer to the same purchase. Ask for supporting context before deciding whether to dismiss, resolve, or investigate further.</p></div>
        <p className={styles.dialogLabel}>A reviewer makes the decision. Current status: Pending review.</p>
      </DialogContent>
    </Dialog>
  );
}
