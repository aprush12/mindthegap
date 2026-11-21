import { useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import type { HandoffView, Priority, SourceRef } from '../../lib/api';
import { HOSPITAL_DOWNLOAD_REASONS } from '../../lib/api/hospital-extra';
import { color, font, priorityStyle, radius } from '../../theme/tokens';
import { Sheet } from '../handoff/Dialogs';
import { PacketPage } from '../handoff/Packet';
import { Icon } from '../Icon';
import { AiLabel, PriorityBadge, SourceLink } from '../ui/Badges';
import { Button, IconButton, LinkButton } from '../ui/Button';
import { Field, RadioRow } from '../ui/Controls';
import { B, T } from '../ui/Text';
import { ExtraIcon, Select } from './Controls';

/** One brief item as the hospital reviewer edits it before sending. */
export interface ReviewItem {
  id: string;
  groupId: string;
  pri: Priority;
  /** Priority the AI proposed; a difference counts as an edit. */
  ai: Priority;
  kind?: string;
  text: string;
  page: string;
  sourceId?: string;
  origin: 'ai' | 'user';
  removed: boolean;
  editing: boolean;
  textEdited: boolean;
}

export type UnclearDecision = 'open' | 'resolving' | 'question' | 'resolved';
export interface ReviewUnclear {
  id: string;
  text: string;
  page: number;
  sourceId: string;
  decision: UnclearDecision;
  resolvedText: string;
}

const PRIORITIES = (['critical', 'important', 'info'] as const).map((k) => ({ key: k, label: priorityStyle[k].label }));

export const itemEdited = (x: ReviewItem) => x.origin === 'ai' && (x.textEdited || x.pri !== x.ai);

function OriginTag({ item }: { item: ReviewItem }) {
  const priChanged = item.origin === 'ai' && item.pri !== item.ai;
  if (item.origin === 'ai' && !itemEdited(item)) return <AiLabel />;
  const label = item.origin === 'user' ? 'Added by you' : `Edited by you${priChanged ? ` · was ${priorityStyle[item.ai].label}` : ''}`;
  return (
    <View style={{ height: 24, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: color.accentSubtle, borderWidth: 1, borderColor: color.deliveredBorder, justifyContent: 'center' }}>
      <T size={12} weight={500} color={color.accent}>
        {label}
      </T>
    </View>
  );
}

/** Priority shown as an editable badge (select inside the badge's colors). */
function PrioritySelect({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  const p = priorityStyle[value];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingLeft: 8, paddingRight: 4, borderRadius: 6, borderWidth: 1, borderColor: p.border, backgroundColor: p.bg }}>
      <Icon name={p.icon} size={14} color={p.fg} strokeWidth={2} />
      <Select plain label="Priority" value={value} onChange={onChange} options={PRIORITIES} height={30} fontSize={13} style={{ color: p.fg }} />
    </View>
  );
}

const SMALL_BTN = { height: 36, paddingHorizontal: 12 } as const;

export function ReviewItemCard({ item, selected, locked, onChange, onSelect, onCancelNew }: { item: ReviewItem; selected: boolean; locked: boolean; onChange: (patch: Partial<ReviewItem>) => void; onSelect: () => void; onCancelNew: () => void }) {
  const [draft, setDraft] = useState(item.text);
  const [page, setPage] = useState(item.page);
  const editing = item.editing && !locked;
  const crit = item.pri === 'critical';
  const pageNum = Number(item.page);
  const startEdit = () => {
    setDraft(item.text);
    setPage(item.page);
    onChange({ editing: true });
  };
  return (
    <View style={{ backgroundColor: color.bgSurface, borderWidth: selected ? 2 : 1, borderColor: selected ? color.accent : crit && !item.removed ? color.criticalBorder : color.borderDefault, borderRadius: radius.lg, paddingVertical: selected ? 15 : 16, paddingHorizontal: selected ? 19 : 20, gap: 10, opacity: item.removed ? 0.85 : 1 }}>
      {item.removed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ExtraIcon name="trash" size={16} color={color.textSecondary} />
          <T size={14} color={color.textSecondary} style={{ flex: 1 }}>
            <B>Removed by you:</B> <T size={14} color={color.textSecondary} style={{ textDecorationLine: 'line-through' }}>{item.text}</T>
          </T>
          <Button variant="secondary" size="sm" fontSize={13} label="Undo" disabled={locked} onPress={() => onChange({ removed: false })} style={SMALL_BTN} />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {locked ? <PriorityBadge priority={item.pri} /> : <PrioritySelect value={item.pri} onChange={(pri) => onChange({ pri })} />}
            {item.kind ? (
              <T size={13} weight={600} color={color.textSecondary}>
                {item.kind}
              </T>
            ) : null}
            <OriginTag item={item} />
            {selected ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="eye" size={14} color={color.accent} />
                <T size={13} weight={600} color={color.accent}>
                  Showing in viewer
                </T>
              </View>
            ) : null}
          </View>
          {editing ? (
            <View style={{ gap: 8 }}>
              <Field label="Item text" value={draft} onChangeText={setDraft} multiline placeholder="Write the item as the receiver should read it" style={{ borderWidth: 2, borderColor: color.accent, fontSize: 16, lineHeight: 24, minHeight: 72 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <T size={13} weight={600} color={color.textSecondary}>
                  Source page
                </T>
                <TextInput
                  accessibilityLabel="Source page"
                  inputMode="numeric"
                  value={page}
                  onChangeText={(v) => setPage(v.replace(/[^0-9]/g, ''))}
                  style={[{ width: 64, height: 36, borderWidth: 1, borderColor: color.borderStrong, borderRadius: 6, paddingHorizontal: 8, fontFamily: font.monoMedium, fontSize: 14, color: color.textPrimary, backgroundColor: color.bgSurface }, Platform.OS === 'web' ? ({ outlineColor: color.accent } as object) : null]}
                />
                <T size={13} color={color.textTertiary}>
                  Required, so the receiver can verify it
                </T>
              </View>
            </View>
          ) : (
            <T size={17} lineHeight={24} weight={600}>
              {item.text}
            </T>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {pageNum ? <SourceLink page={pageNum} onPress={onSelect} /> : <LinkButton label="Source page not set" onPress={onSelect} />}
            <View style={{ flex: 1 }} />
            {editing ? (
              <>
                <Button variant="secondary" size="sm" fontSize={13} label="Cancel" onPress={() => (item.origin === 'user' && !item.text ? onCancelNew() : onChange({ editing: false }))} style={SMALL_BTN} />
                <Button
                  size="sm"
                  fontSize={13}
                  label="Save item"
                  disabled={!draft.trim() || !page}
                  onPress={() => onChange({ editing: false, text: draft.trim(), page, textEdited: item.textEdited || (item.origin === 'ai' && draft.trim() !== item.text) })}
                  style={{ height: 36, paddingHorizontal: 14 }}
                />
              </>
            ) : !locked ? (
              <>
                <Button variant="secondary" size="sm" fontSize={13} icon="edit" label="Edit" onPress={startEdit} style={SMALL_BTN} />
                <RemoveButton onPress={() => onChange({ removed: true })} />
              </>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

function RemoveButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Remove item" onPress={onPress} style={({ pressed }) => ({ ...SMALL_BTN, borderRadius: radius.md, borderWidth: 1, borderColor: color.borderStrong, backgroundColor: color.bgSurface, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.85 : 1 })}>
      <ExtraIcon name="trash" size={14} color={color.critical} strokeWidth={2} />
      <T size={13} weight={600} color={color.critical}>
        Remove
      </T>
    </Pressable>
  );
}

/** Unclear / missing item: the reviewer must resolve it or leave it as a question for the receiver. */
export function UnclearReviewCard({ item, selected, locked, receiver, onSelect, onDecide }: { item: ReviewUnclear; selected: boolean; locked: boolean; receiver: string; onSelect: () => void; onDecide: (d: UnclearDecision, resolvedText?: string) => void }) {
  const [draft, setDraft] = useState(item.resolvedText);
  const d = item.decision;
  return (
    <View style={{ backgroundColor: color.bgSurface, borderWidth: selected ? 2 : 1, borderStyle: selected ? 'solid' : 'dashed', borderColor: selected ? color.accent : color.borderStrong, borderRadius: radius.lg, paddingVertical: selected ? 15 : 16, paddingHorizontal: selected ? 19 : 20, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderStrong }}>
          <Icon name="unclear" size={14} color={color.textPrimary} strokeWidth={2} />
          <T size={13} weight={600}>
            Unclear
          </T>
        </View>
        <AiLabel />
      </View>
      <T size={17} lineHeight={24} weight={600}>
        {item.text}
      </T>
      <View style={{ alignSelf: 'flex-start' }}>
        <SourceLink page={item.page} onPress={onSelect} />
      </View>
      {d === 'open' && !locked ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: color.borderSubtle, paddingTop: 12 }}>
          <Button fontSize={14} label="Resolve with correct information" onPress={() => (onSelect(), onDecide('resolving'))} />
          <Button variant="secondary" fontSize={14} label={`Leave as a question for ${receiver}`} onPress={() => onDecide('question')} />
        </View>
      ) : null}
      {d === 'resolving' && !locked ? (
        <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: color.borderSubtle, paddingTop: 12 }}>
          <Field label="Clarified information, as confirmed with the prescriber" value={draft} onChangeText={setDraft} placeholder="e.g. dose, route and timing" style={{ borderWidth: 2, borderColor: color.accent }} />
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" fontSize={13} label="Cancel" onPress={() => onDecide('open')} style={SMALL_BTN} />
            <Button size="sm" fontSize={13} label="Mark resolved" disabled={!draft.trim()} onPress={() => onDecide('resolved', draft.trim())} style={{ height: 36, paddingHorizontal: 14 }} />
          </View>
        </View>
      ) : null}
      {d === 'question' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: color.borderSubtle, paddingTop: 12, flexWrap: 'wrap' }}>
          <Icon name="message" size={16} color={color.accent} />
          <T size={14} color={color.textSecondary} style={{ flex: 1, minWidth: 200 }}>
            Sent as an open question. {receiver} sees it with an "Ask hospital" button.
          </T>
          {!locked ? <Button variant="secondary" size="sm" fontSize={13} label="Change" onPress={() => onDecide('open')} style={SMALL_BTN} /> : null}
        </View>
      ) : null}
      {d === 'resolved' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: color.borderSubtle, paddingTop: 12, flexWrap: 'wrap' }}>
          <Icon name="check-circle" size={16} color={color.success} />
          <T size={14} style={{ flex: 1, minWidth: 200 }}>
            <B color={color.success}>Resolved by you:</B> {item.resolvedText}
          </T>
          {!locked ? <Button variant="secondary" size="sm" fontSize={13} label="Change" onPress={() => onDecide('open')} style={SMALL_BTN} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Packet viewer for the reviewer: jumps to the page each item cites. Reuses the shared PacketPage mock render. */
export function ReviewViewer({ view, source, index, total, onPrev, onNext, onDownload, dlDone, fill }: { view: HandoffView; source: SourceRef; index: number; total: number; onPrev: () => void; onNext: () => void; onDownload: () => void; dlDone?: string; fill?: boolean }) {
  const page = (
    <View style={{ backgroundColor: color.pdfGutter, padding: 24 }}>
      <PacketPage view={view} source={source} />
    </View>
  );
  return (
    <View accessibilityLabel="Discharge packet viewer" style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, overflow: 'hidden', flex: fill ? 1 : undefined }}>
      <View style={{ paddingVertical: 10, paddingLeft: 16, paddingRight: 12, borderBottomWidth: 1, borderBottomColor: color.borderDefault, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 0 }}>
          <T size={14} weight={600}>
            Discharge packet · {view.handoff.pageCount} pages
          </T>
          <T size={13} color={color.textTertiary}>
            Page {source.page} · {source.section}
          </T>
        </View>
        <IconButton icon="chevron-left" label="Previous cited source" onPress={onPrev} />
        <T size={13} color={color.textSecondary} accessibilityLabel={index >= 0 ? `Cited source ${index + 1} of ${total}` : `Not a cited source, ${total} cited`}>
          {index >= 0 ? index + 1 : '–'} / {total}
        </T>
        <IconButton icon="chevron-right" label="Next cited source" onPress={onNext} />
        <Button variant="secondary" icon="download" label="Download" fontSize={14} onPress={onDownload} />
      </View>
      {dlDone ? (
        <View accessibilityRole="summary" style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: color.bgCanvas, borderBottomWidth: 1, borderBottomColor: color.borderDefault, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="lock" size={14} color={color.textSecondary} />
          <T size={13} color={color.textSecondary}>
            Watermarked download prepared · reason: {dlDone}
          </T>
        </View>
      ) : null}
      {fill ? <ScrollView style={{ flex: 1, backgroundColor: color.pdfGutter }}>{page}</ScrollView> : page}
      <View style={{ paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: color.borderDefault }}>
        <T size={13} color={color.textSecondary}>
          Highlight = text the AI quoted. Edit the item if the brief doesn't match the page.
        </T>
      </View>
    </View>
  );
}

/** Hospital download: reason required, logged, watermarked. */
export function HospitalDownloadDialog({ visible, view, userShort, date, onCancel, onDownload }: { visible: boolean; view: HandoffView; userShort: string; date: string; onCancel: () => void; onDownload: (reason: string) => void }) {
  const [reason, setReason] = useState<(typeof HOSPITAL_DOWNLOAD_REASONS)[number]['key']>('care');
  const [note, setNote] = useState('');
  const needsNote = reason === 'other';
  const label = HOSPITAL_DOWNLOAD_REASONS.find((r) => r.key === reason)!.label;
  return (
    <Sheet visible={visible} onClose={onCancel} maxWidth={520} label="Download discharge packet">
      <View style={{ padding: 24, gap: 16 }}>
        <View style={{ gap: 4 }}>
          <T accessibilityRole="header" variant="title2">
            Download discharge packet
          </T>
          <T size={14} color={color.textSecondary}>
            {view.patient.name} · DOB {view.patient.dob} · MRN {view.patient.mrn} · {view.handoff.pageCount} pages
          </T>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel="Reason (required)" style={{ gap: 2 }}>
          <T size={15} weight={600} style={{ paddingBottom: 8 }}>
            Reason (required)
          </T>
          {HOSPITAL_DOWNLOAD_REASONS.map((r) => (
            <RadioRow key={r.key} boxed={false} selected={r.key === reason} label={r.label} onPress={() => setReason(r.key)} />
          ))}
        </View>
        {needsNote ? <Field label="Note (required for Other)" value={note} onChangeText={setNote} /> : null}
        <View style={{ gap: 8, backgroundColor: color.bgCanvas, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <View style={{ paddingTop: 2 }}>
              <Icon name="activity-log" size={16} color={color.textSecondary} />
            </View>
            <T size={14} lineHeight={20} style={{ flex: 1 }}>
              Downloads are logged with your name, time and reason. Every page is watermarked with your name and the date.
            </T>
          </View>
          <View style={{ alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed', borderColor: color.borderStrong, borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: color.bgSurface }}>
            <T size={12} mono color={color.textTertiary}>
              Watermark preview: {userShort} · {view.from.name} · {date}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" label="Cancel" onPress={onCancel} />
          <Button icon="download" label="Download watermarked PDF" disabled={needsNote && !note.trim()} onPress={() => onDownload(needsNote ? `${label}: ${note.trim()}` : label)} />
        </View>
      </View>
    </Sheet>
  );
}
