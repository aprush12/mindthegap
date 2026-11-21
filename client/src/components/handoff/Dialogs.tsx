import { useState } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import type { HandoffView, BriefItem, SourceRef } from '../../lib/api';
import { getCurrentUser } from '../../lib/api';
import { fmtFull, nowIso } from '../../lib/clock';
import { color, radius, shadow } from '../../theme/tokens';
import { Icon } from '../Icon';
import { Button } from '../ui/Button';
import { RadioRow } from '../ui/Controls';
import { B, Mono, T } from '../ui/Text';

/** Modal on web/wide screens, bottom sheet on iPhone. */
export function Sheet({ visible, onClose, children, maxWidth = 580, label }: { visible: boolean; onClose: () => void; children: React.ReactNode; maxWidth?: number; label: string }) {
  const { width } = useWindowDimensions();
  const asSheet = width < 640;
  return (
    <Modal visible={visible} transparent animationType={asSheet ? 'slide' : 'fade'} onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable accessibilityLabel="Close dialog" onPress={onClose} style={{ flex: 1, backgroundColor: color.overlay, justifyContent: asSheet ? 'flex-end' : 'center', alignItems: 'center', padding: asSheet ? 0 : 24 }}>
        <Pressable
          accessibilityRole="none"
          accessibilityLabel={label}
          onPress={() => {}}
          style={[{ width: '100%', maxWidth: asSheet ? undefined : maxWidth, backgroundColor: color.bgSurface, borderRadius: radius.lg, borderBottomLeftRadius: asSheet ? 0 : radius.lg, borderBottomRightRadius: asSheet ? 0 : radius.lg, maxHeight: '92%', overflow: 'hidden' }, shadow.e2]}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: asSheet ? 24 : 0 }}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * C-10 · Acknowledgment confirmation. Repeats the patient identifiers and states exactly
 * who, when and which items.
 */
export function AckConfirmSheet({ visible, view, items, sources, openUnclear, onCancel, onConfirm, busy }: { visible: boolean; view: HandoffView; items: BriefItem[]; sources: (id: string) => SourceRef; openUnclear: string[]; onCancel: () => void; onConfirm: () => void; busy?: boolean }) {
  const me = getCurrentUser();
  const { patient, from } = view;
  return (
    <Sheet visible={visible} onClose={onCancel} label="Acknowledge handoff?">
      <View style={{ paddingTop: 24, paddingHorizontal: 24, gap: 6 }}>
        <T accessibilityRole="header" variant="title2">
          Acknowledge handoff?
        </T>
        <T size={14} color={color.textSecondary}>
          <B color={color.textPrimary}>{patient.name}</B> · DOB {patient.dob} · MRN {patient.mrn}
        </T>
      </View>
      <View style={{ paddingVertical: 20, paddingHorizontal: 24, gap: 16 }}>
        <T size={15} lineHeight={22}>
          You confirm you have reviewed these {items.length} critical items against the discharge packet:
        </T>
        <View style={{ gap: 8 }}>
          {items.map((it) => (
            <View key={it.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ paddingTop: 2 }}>
                <Icon name="check-circle" size={18} color={color.success} />
              </View>
              <T size={15} lineHeight={22} style={{ flex: 1 }}>
                {it.text} <T size={15} color={color.textTertiary}>· p.{sources(it.sourceId).page}</T>
              </T>
            </View>
          ))}
        </View>
        <View style={{ backgroundColor: color.bgCanvas, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14, gap: 6 }}>
          {[
            ['Who', `${me.name} · ${view.to.name}`],
            ['When', fmtFull(nowIso())],
            ['Shared', `${from.name} sees this confirmation`],
          ].map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row' }}>
              <T size={14} color={color.textTertiary} style={{ width: 72 }}>
                {k}
              </T>
              <T size={14} style={{ flex: 1 }} mono={k === 'When'}>
                {v}
              </T>
            </View>
          ))}
        </View>
        {openUnclear.length ? (
          <T size={13} lineHeight={18} color={color.textTertiary}>
            {openUnclear.length} unclear item{openUnclear.length === 1 ? '' : 's'} stay{openUnclear.length === 1 ? 's' : ''} open ({openUnclear.join('; ')}). Acknowledging does not close {openUnclear.length === 1 ? 'it' : 'them'}.
          </T>
        ) : null}
      </View>
      <View style={{ paddingTop: 16, paddingBottom: 24, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'flex-end', gap: 12, borderTopWidth: 1, borderTopColor: color.borderSubtle, flexWrap: 'wrap' }}>
        <Button variant="secondary" size="lg" fontSize={15} label="Go back" onPress={onCancel} />
        <Button size="lg" fontSize={15} icon="check-circle" label={busy ? 'Confirming…' : 'Confirm acknowledgment'} onPress={onConfirm} disabled={busy} />
      </View>
    </Sheet>
  );
}

const REASONS = ['Print for bedside chart', 'Import into our records system', 'Share with covering clinician', 'Other (describe)'];

/** C-20 · Viewing needs no reason; taking a copy out of Handoff does. */
export function DownloadReasonDialog({ visible, view, onCancel, onDownload }: { visible: boolean; view: HandoffView; onCancel: () => void; onDownload: (reason: string) => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  return (
    <Sheet visible={visible} onClose={onCancel} maxWidth={440} label="Why are you downloading this packet?">
      <View style={{ padding: 24, gap: 16 }}>
        <T accessibilityRole="header" variant="title2">
          Why are you downloading this packet?
        </T>
        <T size={14} color={color.textSecondary}>
          {view.patient.name} · DOB {view.patient.dob} · {view.handoff.pageCount} pages
        </T>
        <View accessibilityRole="radiogroup" style={{ gap: 4 }}>
          {REASONS.map((r) => (
            <RadioRow key={r} boxed={false} selected={r === reason} label={r} onPress={() => setReason(r)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Icon name="lock" size={14} color={color.textTertiary} />
          <T size={13} color={color.textTertiary} style={{ flex: 1 }}>
            Logged with your name, time and reason. The file is watermarked with your name.
          </T>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
          <Button variant="secondary" label="Cancel" onPress={onCancel} />
          <Button icon="download" label="Download" onPress={() => onDownload(reason)} />
        </View>
      </View>
    </Sheet>
  );
}

/** C-19 · Session timeout. Patient data is hidden behind the countdown; drafts are kept. */
export function SessionTimeoutDialog({ visible, seconds, onStay, onSignOut }: { visible: boolean; seconds: number; onStay: () => void; onSignOut: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay}>
      <View style={{ flex: 1, backgroundColor: 'rgba(245,247,250,0.96)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View accessibilityRole="alert" style={[{ width: '100%', maxWidth: 440, backgroundColor: color.bgSurface, borderRadius: radius.lg, padding: 24, gap: 14, alignItems: 'center' }, shadow.e2]}>
          <View style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: color.importantBg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="session-clock" size={26} color={color.important} />
          </View>
          <T variant="title2" align="center">
            Still there?
          </T>
          <T size={15} lineHeight={22} color={color.textSecondary} align="center">
            To protect patient privacy you'll be signed out in <Mono weight={500} color={color.textPrimary}>{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</Mono>. Your draft message is saved.
          </T>
          <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="secondary" label="Sign out now" onPress={onSignOut} />
            <Button label="Stay signed in" onPress={onStay} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
