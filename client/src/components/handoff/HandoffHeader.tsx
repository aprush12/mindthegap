import { router } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import type { HandoffView } from '../../lib/api';
import { Breadcrumb } from '../layout/Shell';
import { Tabs } from '../ui/Controls';
import { IdentityBanner } from './IdentityBanner';
import { StatusTrail } from './Status';

export type HandoffTab = 'brief' | 'packet' | 'thread' | 'activity';

/**
 * Pinned header for every aftercare patient screen: breadcrumb, identity banner (name + DOB + MRN),
 * section tabs and the status trail. Rendered outside the scroll area so it never scrolls away.
 */
export function HandoffHeader({ view, tab, onTab, threadCount }: { view: HandoffView; tab: HandoffTab; onTab?: (t: HandoffTab) => void; threadCount?: number }) {
  const { width } = useWindowDimensions();
  const base = `/aftercare/${view.handoff.id}`;
  const go = (t: HandoffTab) => {
    if (onTab && (t === 'brief' || t === 'packet')) return onTab(t);
    router.navigate((t === 'brief' || t === 'packet' ? `${base}?tab=${t}` : `${base}/${t}`) as never);
  };
  return (
    <View style={{ gap: 12 }}>
      <Breadcrumb parent="Handoffs" parentHref="/aftercare" current={view.patient.name} />
      <IdentityBanner view={view} onOpenPacket={() => go('packet')} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', columnGap: 24, flexWrap: 'wrap' }}>
        <Tabs
          tabs={[
            { key: 'brief', label: 'Brief' },
            { key: 'packet', label: 'Full packet' },
            { key: 'thread', label: 'Thread', count: threadCount },
            { key: 'activity', label: 'Activity' },
          ]}
          active={tab}
          onChange={go}
        />
        {width < 700 ? null : (
          <View style={{ marginLeft: width < 900 ? 0 : 'auto', paddingBottom: 12, flexShrink: 1, minWidth: 0, maxWidth: '100%' }}>
            <StatusTrail view={view} />
          </View>
        )}
      </View>
    </View>
  );
}
