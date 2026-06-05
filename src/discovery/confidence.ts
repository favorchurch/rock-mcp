export interface DiscoveryCandidate {
  kind: string;
  id?: number;
  guid?: string;
  idKey?: string;
  name: string;
  confidence: number;
  signals: string[];
  warnings?: string[];
}

export function scoreConnectGroupType(name: string): { confidence: number; signals: string[] } {
  let confidence = 0.0;
  const signals: string[] = [];
  const lowerName = name.toLowerCase();

  if (name === 'Connect Groups') {
    confidence += 0.60;
    signals.push('exact name match: Connect Groups');
  } else if (lowerName.includes('connect') && lowerName.includes('group')) {
    confidence += 0.35;
    signals.push('name contains Connect and Group');
  }

  // Check signals/warnings
  if (lowerName.includes('archived') || lowerName.includes('old') || lowerName.includes('deprecated')) {
    confidence -= 0.30;
    signals.push('name contains old/deprecated warning');
  }

  return {
    confidence: Math.max(0, Math.min(1.0, confidence)),
    signals,
  };
}

export function scoreMinistryTeamType(name: string): { confidence: number; signals: string[] } {
  let confidence = 0.0;
  const signals: string[] = [];
  const lowerName = name.toLowerCase();

  if (name === 'Ministry Teams') {
    confidence += 0.60;
    signals.push('exact name match: Ministry Teams');
  } else if (lowerName.includes('ministry') && lowerName.includes('team')) {
    confidence += 0.35;
    signals.push('name contains Ministry and Team');
  } else if (lowerName.includes('serving') || lowerName.includes('service') || lowerName.includes('volunteer')) {
    confidence += 0.20;
    signals.push('name contains serving/volunteer context');
  }

  if (lowerName.includes('archived') || lowerName.includes('old') || lowerName.includes('deprecated')) {
    confidence -= 0.30;
    signals.push('name contains old/deprecated warning');
  }

  return {
    confidence: Math.max(0, Math.min(1.0, confidence)),
    signals,
  };
}
