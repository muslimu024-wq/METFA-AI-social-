/**
 * METFA V2 — Freelancer / Team Module (METFA Freelancer/Team)
 *
 * Specialist rosters, team assignments, work capacity, and contractor contracts.
 * Integrates directly with canonical V2UserRole definitions and the METFA Work pipeline.
 */

import React, { useState } from 'react';
import {
  Users,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  Award,
  Clock,
  UserCheck,
  Code,
  Shield,
  Layers,
  Filter,
} from 'lucide-react';
import { V2UserRole } from '../../../types/v2Admin';

export const CANONICAL_V2_ROLES: V2UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'FINANCE_ADMIN',
  'ADS_MANAGER',
  'CONTENT_MANAGER',
  'OPERATOR',
  'DEVELOPER',
  'FREELANCER',
  'REVIEWER',
  'SUPPORT',
  'ANALYST',
];

interface SpecialistRosterItem {
  id: string;
  name: string;
  role: V2UserRole;
  domain: string;
  clearanceLevel: 'TIER_1_STANDARD' | 'TIER_2_OPERATOR' | 'TIER_3_ELEVATED';
  activeTasksCount: number;
  capacityPercentage: number;
  status: 'ACTIVE' | 'STANDBY' | 'ON_LEAVE';
  verificationBadge: string;
}

const ROSTER_MEMBERS: SpecialistRosterItem[] = [
  {
    id: 'spec_dev_01',
    name: 'Alexander V.',
    role: 'DEVELOPER',
    domain: 'Core Engine & RLS Integrity',
    clearanceLevel: 'TIER_3_ELEVATED',
    activeTasksCount: 2,
    capacityPercentage: 70,
    status: 'ACTIVE',
    verificationBadge: 'Verified Core Contributor',
  },
  {
    id: 'spec_rev_02',
    name: 'Elena Rostova',
    role: 'REVIEWER',
    domain: 'Identity & Creator KYC Validation',
    clearanceLevel: 'TIER_2_OPERATOR',
    activeTasksCount: 4,
    capacityPercentage: 85,
    status: 'ACTIVE',
    verificationBadge: 'Verified Platform Reviewer',
  },
  {
    id: 'spec_free_03',
    name: 'Rahim Chowdhury',
    role: 'FREELANCER',
    domain: 'Creative Audio & Sound Design',
    clearanceLevel: 'TIER_1_STANDARD',
    activeTasksCount: 1,
    capacityPercentage: 40,
    status: 'ACTIVE',
    verificationBadge: 'Verified Audio Specialist',
  },
  {
    id: 'spec_op_04',
    name: 'Marcus Chen',
    role: 'OPERATOR',
    domain: 'Infrastructure & Signal Diagnostics',
    clearanceLevel: 'TIER_2_OPERATOR',
    activeTasksCount: 3,
    capacityPercentage: 60,
    status: 'ACTIVE',
    verificationBadge: 'Verified Operator',
  },
  {
    id: 'spec_fin_05',
    name: 'Sarah Jenkins',
    role: 'FINANCE_ADMIN',
    domain: 'Settlement Reconciliation & Payouts',
    clearanceLevel: 'TIER_3_ELEVATED',
    activeTasksCount: 2,
    capacityPercentage: 50,
    status: 'ACTIVE',
    verificationBadge: 'Verified Finance Lead',
  },
];

export const V2FreelancerTeamModule: React.FC = () => {
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');

  const filteredMembers = ROSTER_MEMBERS.filter(
    (m) => selectedRoleFilter === 'ALL' || m.role === selectedRoleFilter
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  METFA Freelancer / Team
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  <UserCheck className="w-3 h-3 mr-1" />
                  Roster Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Specialist rosters, team assignments, work capacity, and contractor contracts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Specialists Enrolled: <strong className="text-blue-700 font-bold">{ROSTER_MEMBERS.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Role Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedRoleFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              selectedRoleFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Roles
          </button>
          {['DEVELOPER', 'REVIEWER', 'FREELANCER', 'OPERATOR', 'FINANCE_ADMIN'].map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRoleFilter(role)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-mono ${
                selectedRoleFilter === role
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        {/* Specialist Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                    {member.role}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      member.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {member.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{member.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{member.domain}</p>

                <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Clearance:</span>
                    <span className="font-mono font-bold text-slate-700">{member.clearanceLevel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Active Tasks:</span>
                    <span className="font-bold text-slate-800">{member.activeTasksCount} assigned</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Capacity:</span>
                    <span className="font-bold text-blue-700">{member.capacityPercentage}% utilized</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{member.verificationBadge}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default V2FreelancerTeamModule;
