import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { BriefGroup, BriefItem, SourceRef, UnclearItem } from '../../lib/api';
import { color, radius } from '../../theme/tokens';
import { Icon } from '../Icon';
import { AiLabel, PriorityBadge, SourceLink, UnclearBadge } from '../ui/Badges';
import { Button } from '../ui/Button';
import { Field, ReviewedCheckbox } from '../ui/Controls';
import { B, T } from '../ui/Text';

/**
 * C-05 · Brief item card. Every AI item names its source page. Critical items carry their own
 * "Reviewed" checkbox; Important and Info items do not block acknowledgment.
 */
export function BriefItemCard({ item, source, checked, selected, locked, onToggle, onViewSource, phone }: { item: BriefItem; source: SourceRef; checked: boolean; selected?: boolean; locked?: boolean; onToggle?: () => void; onViewSource: () => void; phone?: boolean }) {
  const isCrit = item.priority === 'critical';
  const borderColor = selected ? color.accent : isCrit && !checked ? color.criticalBorder : color.borderDefault;
  return (
    <View
      style={{ backgroundColor: selected ? color.accentSelectedBg : color.bgSurface, borderWidth: selected || (phone && isCrit && !checked) ? 2 : 1, borderColor, borderRadius: radius.lg, paddingVertical: phone ? 14 : 16, paddingHorizontal: phone ? 14 : 20, gap: 10 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, flexWrap: 'wrap' }}>
        <PriorityBadge priority={item.priority} size={phone ? 'lg' : 'md'} />
        {item.kind ? (
          <T size={phone ? 15 : 13} weight={600} color={color.textSecondary}>
            {item.kind}
          </T>
        ) : null}
        {selected ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="eye" size={14} color={color.accent} />
            <T size={13} weight={600} color={color.accent}>
              Showing in viewer
            </T>
          </View>
        ) : null}
        {isCrit && onToggle ? (
          <View style={{ marginLeft: 'auto' }}>
            <ReviewedCheckbox checked={checked} onToggle={onToggle} disabled={locked} label={item.text} large={phone} />
          </View>
        ) : null}
      </View>
      <T size={phone ? 18 : 17} lineHeight={phone ? 25 : 24} weight={600}>
        {item.text}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {phone ? <AiLabel text="AI-generated" /> : null}
        <SourceLink page={source.page} onPress={onViewSource} short={phone} />
        {checked ? (
          <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="check-circle" size={14} color={color.success} />
            <T size={13} color={color.success}>
              Reviewed by you
            </T>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const GROUP_META = (g: BriefGroup) => {
  const crit = g.items.filter((i) => i.priority === 'critical').length;
  const imp = g.items.filter((i) => i.priority === 'important').length;
  if (crit) return { text: `${crit} critical`, c: color.critical };
  if (imp) return { text: `${imp} important`, c: color.important };
  return { text: g.items.length ? `${g.items.length} info` : 'None found', c: color.textTertiary };
};

export function BriefGroupHeader({ group, phone }: { group: BriefGroup; phone?: boolean }) {
  const m = GROUP_META(group);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
      <Icon name={group.icon} size={20} color={color.textSecondary} />
      <T accessibilityRole="header" size={phone ? 19 : 18} lineHeight={26} weight={600} style={{ flexShrink: 1 }}>
        {group.title}
      </T>
      <T size={13} weight={500} color={m.c}>
        {m.text}
      </T>
    </View>
  );
}

/**
 * C-06 · Unclear-item card. Lists what the packet is missing or contradicts.
 * "Ask hospital" opens a composer with a pre-filled question and the item quoted.
 */
export function UnclearItemCard({ item, source, selected, onViewSource, onSend, phone }: { item: UnclearItem; source: SourceRef; selected?: boolean; onViewSource: () => void; onSend?: (question: string) => void; phone?: boolean }) {
  const [asking, setAsking] = useState(false);
  const [q, setQ] = useState(item.suggestedQuestion);
  return (
    <View style={{ backgroundColor: color.bgSurface, borderWidth: selected ? 2 : 1, borderStyle: selected ? 'solid' : 'dashed', borderColor: selected ? color.accent : color.borderStrong, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: phone ? 14 : 20, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 32 }}>
        <UnclearBadge />
        <AiLabel />
      </View>
      <T size={17} weight={600}>
        {item.text}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <SourceLink page={source.page} onPress={onViewSource} short={phone} />
        {onSend ? <Button style={{ marginLeft: 'auto' }} variant="outlineAccent" size="md" icon="message" label="Ask hospital" fontSize={14} onPress={() => setAsking((a) => !a)} /> : null}
      </View>
      {asking && onSend ? (
        <View style={{ borderTopWidth: 1, borderTopColor: color.borderSubtle, paddingTop: 12, gap: 10 }}>
          <QuoteChip kind="Unclear" text={item.text} page={source.page} />
          <Field label="Question to the hospital" value={q} onChangeText={setQ} multiline />
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="secondary" label="Cancel" fontSize={14} onPress={() => setAsking(false)} />
            <Button
              label="Send to thread"
              fontSize={14}
              disabled={!q.trim()}
              onPress={() => {
                onSend(q);
                setAsking(false);
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function QuoteChip({ kind, text, page, onClear }: { kind: string; text: string; page?: number; onClear?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.accentSubtle, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 10 }}>
      <Icon name="reply-quote" size={16} color={color.accent} />
      <T size={13} style={{ flex: 1 }}>
        <B>{kind}</B> · {text}
        {page ? ` · p.${page}` : ''}
      </T>
      {onClear ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Remove quote" onPress={onClear} hitSlop={10}>
          <Icon name="x" size={16} color={color.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}
