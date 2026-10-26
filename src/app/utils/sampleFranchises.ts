// Sample franchises for the prototype, loaded into the Franchise Master when it is empty.
// They cover every sync state the Order Management module shows, plus one inactive franchise
// and districts with no franchise at all, so auto-assignment can be seen succeeding and failing.

export const SYNC_KEY = 'franchiseLastSync';
const MASTER_KEY = 'franchiseMaster';

interface SampleFranchise {
  key: string;
  name: string;
  owner: string;
  zone: string;
  region: string;
  district: string;
  tehsil: string;
  salesUnit: string;
  bsaId: string;
  bsaName: string;
  villages: [string, string][];
  status: 'Active' | 'Inactive';
  minutesSinceSync: number;
}

const DAY = 24 * 60;

export const SAMPLE_FRANCHISES: SampleFranchise[] = [
  { key: 'FR-101', name: 'Naya Savera Sahiwal', owner: 'Muhammad Arshad', zone: 'Central Zone', region: 'Sahiwal Region', district: 'Sahiwal', tehsil: 'Sahiwal', salesUnit: 'Sahiwal SU', bsaId: 'BSA-201', bsaName: 'Kamran Ali', villages: [['VLG-1011', 'Chak 12'], ['VLG-1012', 'Dera Rahim']], status: 'Active', minutesSinceSync: 4 },
  { key: 'FR-102', name: 'Naya Savera Okara', owner: 'Rana Javed', zone: 'Central Zone', region: 'Sahiwal Region', district: 'Okara', tehsil: 'Okara', salesUnit: 'Okara SU', bsaId: 'BSA-202', bsaName: 'Adeel Raza', villages: [['VLG-1021', 'Chak 9 Pull'], ['VLG-1022', 'Renala Khurd']], status: 'Active', minutesSinceSync: 35 },
  { key: 'FR-103', name: 'Naya Savera Faisalabad', owner: 'Shahid Mehmood', zone: 'Central Zone', region: 'Faisalabad Region', district: 'Faisalabad', tehsil: 'Jaranwala', salesUnit: 'Faisalabad SU', bsaId: 'BSA-203', bsaName: 'Zubair Ahmed', villages: [['VLG-1031', 'Chak 88 JB'], ['VLG-1032', 'Chak 204 RB']], status: 'Active', minutesSinceSync: 180 },
  { key: 'FR-104', name: 'Naya Savera Sargodha', owner: 'Malik Aslam', zone: 'Central Zone', region: 'Faisalabad Region', district: 'Sargodha', tehsil: 'Sargodha', salesUnit: 'Sargodha SU', bsaId: 'BSA-204', bsaName: 'Fahad Iqbal', villages: [['VLG-1041', 'Chak 45 SB'], ['VLG-1042', 'Kot Momin']], status: 'Active', minutesSinceSync: 26 * 60 },
  { key: 'FR-105', name: 'Naya Savera Multan', owner: 'Syed Ali Raza', zone: 'South Zone', region: 'Multan Region', district: 'Multan', tehsil: 'Shujabad', salesUnit: 'Multan SU', bsaId: 'BSA-205', bsaName: 'Hassan Bukhari', villages: [['VLG-1051', 'Basti Malook'], ['VLG-1052', 'Bosan']], status: 'Active', minutesSinceSync: 50 * 60 },
  { key: 'FR-106', name: 'Naya Savera Khanewal', owner: 'Chaudhry Nasir', zone: 'South Zone', region: 'Multan Region', district: 'Khanewal', tehsil: 'Mian Channu', salesUnit: 'Khanewal SU', bsaId: 'BSA-206', bsaName: 'Imtiaz Hussain', villages: [['VLG-1061', 'Mian Channu'], ['VLG-1062', 'Tulamba']], status: 'Active', minutesSinceSync: 6 * DAY },
  { key: 'FR-107', name: 'Naya Savera Vehari', owner: 'Zahid Iqbal', zone: 'South Zone', region: 'Multan Region', district: 'Vehari', tehsil: 'Burewala', salesUnit: 'Vehari SU', bsaId: 'BSA-207', bsaName: 'Qasim Ali', villages: [['VLG-1071', 'Jhok Sial'], ['VLG-1072', 'Chak 130 EB']], status: 'Active', minutesSinceSync: 9 },
  { key: 'FR-108', name: 'Naya Savera Bahawalpur', owner: 'Abdul Rauf', zone: 'South Zone', region: 'Bahawalpur Region', district: 'Bahawalpur', tehsil: 'Hasilpur', salesUnit: 'Bahawalpur SU', bsaId: 'BSA-208', bsaName: 'Naeem Akhtar', villages: [['VLG-1081', 'Pul Bagar']], status: 'Inactive', minutesSinceSync: 20 * DAY },
  { key: 'FR-109', name: 'Naya Savera Gujranwala', owner: 'Tahir Butt', zone: 'North Zone', region: 'Gujranwala Region', district: 'Gujranwala', tehsil: 'Kamoke', salesUnit: 'Gujranwala SU', bsaId: 'BSA-209', bsaName: 'Waqas Cheema', villages: [['VLG-1091', 'Satellite Town'], ['VLG-1092', 'GT Road']], status: 'Active', minutesSinceSync: 12 * 60 },
];

function masterRows() {
  return SAMPLE_FRANCHISES.flatMap(f => f.villages.map(([villageId, villageName], n) => ({
    id: `${f.key}-${n + 1}`,
    province: 'Punjab', zone: f.zone, region: f.region, district: f.district, tehsil: f.tehsil, salesUnit: f.salesUnit,
    bsaId: f.bsaId, bsaName: f.bsaName, bsaInfo1: `${f.salesUnit} territory`, bsaInfo2: '', bsaInfo3: '',
    associatedFranchiseId: f.key, franchiseName: f.name, franchiseOwnerName: f.owner,
    franchisePhone: `0301-${f.key.slice(-3)}0000`, franchiseEmail: `${f.key.toLowerCase()}@example.com`,
    franchiseAddress: `Main Bazar, ${f.tehsil}, ${f.district}`, franchiseStatus: f.status,
    villageId, villageName, villageInfo1: '', villageInfo2: '',
  })));
}

/** Sets each sample franchise's last-sync time relative to now, so its sync state reads as designed. */
export function resetSampleSyncTimes() {
  let map: Record<string, string> = {};
  try { map = JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); } catch { /* start fresh */ }
  SAMPLE_FRANCHISES.forEach(f => { map[f.key] = new Date(Date.now() - f.minutesSinceSync * 60_000).toISOString(); });
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(map)); } catch { /* storage unavailable */ }
}

/** Loads the sample franchises when no Franchise Master has been uploaded yet. */
export function ensureSampleFranchises() {
  try {
    const existing = JSON.parse(localStorage.getItem(MASTER_KEY) || '[]');
    if (Array.isArray(existing) && existing.length > 0) return;
    localStorage.setItem(MASTER_KEY, JSON.stringify(masterRows()));
    resetSampleSyncTimes();
  } catch { /* storage unavailable: the app runs without sample franchises */ }
}

/** Franchise details for sample orders, which reference the sample franchises by key. */
export function sampleFranchise(key: string) {
  const f = SAMPLE_FRANCHISES.find(s => s.key === key)!;
  return { key: f.key, name: f.name, zone: f.zone, region: f.region, salesUnit: f.salesUnit };
}
