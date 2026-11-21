import { Pressable, View } from 'react-native';
import type { BriefItem, SourceRef } from '../../lib/api';
import { color, priorityStyle } from '../../theme/tokens';
import { Icon, type IconName } from '../Icon';
import { CheckRow } from '../ui/Controls';
import { T } from '../ui/Text';
import { PhoneSourceLink } from './Parts';

const CARD = { backgroundColor: color.bgSurface, borderRadius: 14, padding: 16 } as const;

function Tag({ icon, label, fg, bg, border }: { icon: IconName; label: string; fg: string; bg: string; border: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 4, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
      <Icon name={icon} size={15} color={fg} strokeWidth={2} />
      <T size={15} weight={600} color={fg}>
        {label}
      </T>
    </View>
  );
}

/**
 * iPhone critical item (design PhoneBrief): badge, kind, text, "View source p.X" and a full-width
 * 52pt "Mark as reviewed" checkbox. Red edge until checked.
 */
export function PhoneCriticalCard({ item, source, kind, checked, locked, onToggle, onViewSource }: { item: BriefItem; source: SourceRef; kind?: string; checked: boolean; locked?: boolean; onToggle: () => void; onViewSource: () => void }) {
  const p = priorityStyle.critical;
  return (
    <View style={[CARD, { borderWidth: 2, borderColor: checked ? color.borderDefault : color.criticalBorder, gap: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Tag icon={p.icon} label={p.label} fg={p.fg} bg={p.bg} border={p.border} />
        {kind ? (
          <T size={15} weight={600} color={color.textSecondary}>
            {kind}
          </T>
        ) : null}
      </View>
      <T size={19} lineHeight={26} weight={600}>
        {item.text}
      </T>
      <PhoneSourceLink page={source.page} onPress={onViewSource} />
      {/* Locked after acknowledgment: the row stays visible but cannot change. */}
      <View pointerEvents={locked ? 'none' : 'auto'} accessibilityState={{ disabled: !!locked }}>
        <CheckRow checked={checked} onToggle={onToggle} label={checked ? 'Reviewed' : 'Mark as reviewed'} />
      </View>
    </View>
  );
}

/** Important / Info item: tag with group name, text, source link. No checkbox (doesn't block acknowledging). */
export function PhoneItemCard({ item, source, group, onViewSource }: { item: BriefItem; source: SourceRef; group: string; onViewSource: () => void }) {
  const p = priorityStyle[item.priority];
  return (
    <View style={[CARD, { borderWidth: 1, borderColor: color.borderDefault, gap: 8 }]}>
      <Tag icon={p.icon} label={`${p.label} · ${group}`} fg={p.fg} bg={p.bg} border={p.border} />
      <T size={17} lineHeight={24} weight={600}>
        {item.text}
      </T>
      <PhoneSourceLink page={source.page} onPress={onViewSource} />
    </View>
  );
}

/** Unclear / missing item with "Ask hospital" (opens the thread with the item quoted). */
export function PhoneUnclearCard({ text, source, onViewSource, onAsk }: { text: string; source: SourceRef; onViewSource: () => void; onAsk: () => void }) {
  return (
    <View style={[CARD, { borderWidth: 1, borderStyle: 'dashed', borderColor: color.borderStrong, gap: 10 }]}>
      <Tag icon="unclear" label="Unclear" fg={color.textPrimary} bg={color.bgSurface} border={color.borderStrong} />
      <T size={17} lineHeight={24} weight={600}>
        {text}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <PhoneSourceLink page={source.page} onPress={onViewSource} />
        <Pressable accessibilityRole="button" onPress={onAsk} style={({ pressed }) => ({ marginLeft: 'auto', height: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: color.accent, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: pressed ? color.accentSubtle : color.bgSurface })}>
          <Icon name="message" size={18} color={color.accent} />
          <T size={16} weight={600} color={color.accent}>
            Ask hospital
          </T>
        </Pressable>
      </View>
    </View>
  );
}
