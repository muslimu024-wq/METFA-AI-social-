/**
 * METFA V2 — Work Module (METFA Work)
 *
 * Operational work center, task execution pipelines, and deliverable submissions.
 * Replaces foundation placeholder with the live task execution pipeline connecting signals to deliverables.
 */

import React, { useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  FileText,
  Bot,
  ShieldCheck,
  Layers,
  ChevronRight,
  Filter,
  Check,
  Send,
} from 'lucide-react';
import { MetfaTask, TaskPriority, TaskStatus } from '../../../types/v2';

const ACTIVE_WORK_TASKS: MetfaTask[] = [
  {
    id: 'task_work_101',
    sourceSignalId: 'rsig_audit_verif',
    affectedModule: 'verified',
    title: 'Identity Document Hash & Portfolio Validation',
    description: 'Verify creator KYC documentation hash against portfolio submission records.',
    aiBrief: {
      problemStatement: 'New creator application awaiting dual-signature verification.',
      suggestedFix: 'Inspect sha256 reference against submitted portfolio media authenticity.',
      safetyDirectives: ['Do not store plain image documents', 'Preserve zero-knowledge hash references'],
      generatedAt: new Date().toISOString(),
    },
    requirements: [
      'Confirm at least 5 public posts authored',
      'Validate national ID hash conformity',
      'Verify zero duplicate biometric flags',
    ],
    doNotChangeConstraints: ['Never expose raw government documents', 'Maintain tamper-evident audit log'],
    deliverables: [
      {
        id: 'deliv_1',
        title: 'KYC Portfolio Checklist',
        description: 'Completed verification checklist with audit signature.',
      },
    ],
    acceptanceCriteria: ['Dual-signature by Reviewer and Admin', 'Audit record posted to v2_audit_logs'],
    testRequirements: ['Idempotency test against repeated submission'],
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assignment: {
      assignedToId: 'spec_rev_02',
      assignedToName: 'Elena Rostova',
      assignmentType: 'individual',
      assignedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task_work_102',
    sourceSignalId: 'rsig_settlement_reconcile',
    affectedModule: 'rewards',
    title: 'Reward Pool Revenue Mathematical Reconciliation',
    description: 'Reconcile net eligible revenue ledger against proportional reward pool allocations.',
    aiBrief: {
      problemStatement: 'Reward cycle closing for Phase 6 distribution.',
      suggestedFix: 'Ensure sum of user points * dynamically calculated point value <= total eligible pool.',
      safetyDirectives: ['Invariant: Zero monetary promises for specific actions', 'Pool allocation must never exceed revenue'],
      generatedAt: new Date().toISOString(),
    },
    requirements: [
      'Gross revenue - deductions = eligible net revenue',
      'Dynamic point value calculation verified',
      'Zero floating-point drift verified using integer cents',
    ],
    doNotChangeConstraints: ['Never hardcode fixed exchange rates (e.g. 100 CP = $X)'],
    deliverables: [
      {
        id: 'deliv_2',
        title: 'Settlement Ledger Variance Report',
        description: 'Mathematical proof of zero variance between pool and distributed shares.',
      },
    ],
    acceptanceCriteria: ['Reconciliation variance equals $0.00', 'Finance Admin approval signed'],
    testRequirements: ['Zero overallocation unit verification'],
    priority: 'HIGH',
    status: 'AI_REVIEWED',
    aiReview: {
      checklistScore: 98,
      findings: ['Mathematical proof validated', 'Zero variance detected against gross pool'],
      isApprovedByAi: true,
      reviewedAt: new Date().toISOString(),
    },
    assignment: {
      assignedToId: 'spec_fin_05',
      assignedToName: 'Sarah Jenkins',
      assignmentType: 'individual',
      assignedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task_work_103',
    sourceSignalId: 'rsig_audio_sync_licensing',
    affectedModule: 'audio',
    title: 'Audio Attribution & Commercial License Sync',
    description: 'Audit attribution pipeline for original audio tracks used across 90s Reels.',
    aiBrief: {
      problemStatement: 'Ensure creators using licensed tracks generate appropriate CP attribution for audio owners.',
      suggestedFix: 'Verify v2IntegrationAdapter audioAttributions counter matches reel watch events.',
      safetyDirectives: ['Native Voice Post belongs exclusively to Social', 'Audio tracks must maintain attribution license terms'],
      generatedAt: new Date().toISOString(),
    },
    requirements: [
      'Attribution CP awarded strictly to audio owner',
      'Self-listening fraud screening active',
      'Audio catalog licenses confirmed active',
    ],
    doNotChangeConstraints: ['Voice Post native structure must remain untouched'],
    deliverables: [
      {
        id: 'deliv_3',
        title: 'Audio Sync Compliance Log',
        description: 'Verification of reel audio attribution accuracy.',
      },
    ],
    acceptanceCriteria: ['Attribution confirmed for licensed tracks', 'No duplicate play attribution'],
    testRequirements: ['Multi-reel attribution replay test'],
    priority: 'MEDIUM',
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const V2WorkModule: React.FC = () => {
  const [selectedTask, setSelectedTask] = useState<MetfaTask | null>(ACTIVE_WORK_TASKS[0]);
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | TaskStatus>('ALL');

  const filteredTasks = ACTIVE_WORK_TASKS.filter(
    (t) => activeTabFilter === 'ALL' || t.status === activeTabFilter
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white shadow-xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  METFA Work
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                  Execution Pipeline Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Operational work center, task execution pipelines, and deliverable submissions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Active Pipeline Tasks: <strong className="text-slate-900 font-bold">{ACTIVE_WORK_TASKS.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Pipeline Stage Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px] text-xs">
            {['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'AI_REVIEWED', 'ADMIN_APPROVED', 'COMPLETED'].map((stage, idx, arr) => (
              <React.Fragment key={stage}>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-700 font-mono">
                    {idx + 1}
                  </span>
                  <span className="text-slate-700">{stage}</span>
                </div>
                {idx < arr.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Task Browser Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tasks List */}
          <div className="lg:col-span-1 space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Active Work Packages
            </span>

            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  selectedTask?.id === task.id
                    ? 'bg-slate-100 border-slate-400 ring-1 ring-slate-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800">
                    {task.affectedModule.toUpperCase()}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      task.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : task.status === 'AI_REVIEWED'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-slate-900 mb-1">{task.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-100">
                  <span>Priority: {task.priority}</span>
                  <span>{task.assignment?.assignedToName || 'Unassigned'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Task Detailed View */}
          <div className="lg:col-span-2">
            {selectedTask ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-mono text-purple-700 font-bold uppercase tracking-wider bg-purple-50 px-2 py-0.5 rounded">
                      Module: {selectedTask.affectedModule} • Priority: {selectedTask.priority}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-2">
                      {selectedTask.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                      Task ID: {selectedTask.id} • Assigned: {selectedTask.assignment?.assignedToName || 'Open Queue'}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800">
                    {selectedTask.status}
                  </span>
                </div>

                {/* AI Brief */}
                <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                    <Bot className="w-4 h-4 text-purple-600" />
                    <span>AI Task Preparation & Directives</span>
                  </div>
                  <p className="text-xs text-purple-900/90 leading-relaxed">
                    <strong>Problem:</strong> {selectedTask.aiBrief.problemStatement}
                  </p>
                  <p className="text-xs text-purple-800 leading-relaxed">
                    <strong>Suggested Approach:</strong> {selectedTask.aiBrief.suggestedFix}
                  </p>
                  <div className="text-[11px] text-purple-700 space-y-0.5 pt-1">
                    {selectedTask.aiBrief.safetyDirectives.map((d, i) => (
                      <div key={i}>• {d}</div>
                    ))}
                  </div>
                </div>

                {/* Requirements & Constraints */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Requirements
                    </h4>
                    <ul className="text-xs text-slate-600 space-y-1">
                      {selectedTask.requirements.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Do-Not-Change Constraints
                    </h4>
                    <ul className="text-xs text-slate-600 space-y-1">
                      {selectedTask.doNotChangeConstraints.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Deliverables */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Required Deliverables
                  </h4>
                  {selectedTask.deliverables.map((deliv) => (
                    <div
                      key={deliv.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{deliv.title}</div>
                        <div className="text-slate-500 text-[11px]">{deliv.description}</div>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Deliverable Verified
                      </span>
                    </div>
                  ))}
                </div>

                {/* AI Review Score if present */}
                {selectedTask.aiReview && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>AI Verification Checklist: <strong>{selectedTask.aiReview.checklistScore} / 100</strong> (Approved by AI Directive)</span>
                    </div>
                    <span className="text-[11px] text-emerald-700 font-mono">Awaiting Final Operator Signature</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
                Select a work package to view execution parameters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default V2WorkModule;
