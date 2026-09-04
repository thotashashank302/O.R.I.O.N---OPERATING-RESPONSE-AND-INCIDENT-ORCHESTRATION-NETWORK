export interface CategoryHandler {
  responsibleGroup: string;
  defaultVerifier: string;
  isSafetyCritical: boolean;
}

export const CATEGORY_HANDLER_MAP: Record<string, CategoryHandler> = {
  "IT/network/Wi-Fi/system issue": {
    responsibleGroup: "IT Support Team",
    defaultVerifier: "Assigned Lab Owner / Reporting CR",
    isSafetyCritical: false,
  },
  "Electrical/fan/AC": {
    responsibleGroup: "Electrical & HVAC Facilities",
    defaultVerifier: "Authorized CR / Lab Owner (post-safety clearance)",
    isSafetyCritical: true,
  },
  "Cleaning/sanitation": {
    responsibleGroup: "Sanitation Services",
    defaultVerifier: "Reporting CR / Location Owner",
    isSafetyCritical: false,
  },
  "Facilities/furniture/plumbing": {
    responsibleGroup: "General Maintenance Team",
    defaultVerifier: "Reporting CR / Location Owner",
    isSafetyCritical: false,
  },
  "Door/key/access issue": {
    responsibleGroup: "Campus Security & Access Control",
    defaultVerifier: "Authorized Requester / Location Owner",
    isSafetyCritical: true,
  },
  Transport: {
    responsibleGroup: "Transport Administration",
    defaultVerifier: "Verified Route Rider / Transport Supervisor",
    isSafetyCritical: false,
  },
  "Club operations": {
    responsibleGroup: "Student Affairs & Club Leadership",
    defaultVerifier: "Non-Conflicted Club Coordinator",
    isSafetyCritical: false,
  },
  "Emergency/safety": {
    responsibleGroup: "Designated Human Emergency Lead",
    defaultVerifier: "Campus Safety Supervisor",
    isSafetyCritical: true,
  },
  "Personal/CR misconduct": {
    responsibleGroup: "Confidential Case Handler",
    defaultVerifier: "Principal / Independent Reviewer",
    isSafetyCritical: true,
  },
};
