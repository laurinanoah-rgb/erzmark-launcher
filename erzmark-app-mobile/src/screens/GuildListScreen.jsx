import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, Modal, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getMyGuild,
  updateGuildDescription,
  updateGuildRules,
  createGuildRole,
  updateGuildRole,
  deleteGuildRole,
  assignMemberRole,
  createGuildEvent,
  updateGuildEvent,
  deleteGuildEvent,
} from "../api/guilds";
import { getStoredToken } from "../api/auth";
import { colors, radius, spacing } from "../theme";

const PERMISSION_LABELS = {
  manage_description: "Beschreibung bearbeiten",
  manage_rules: "Regeln bearbeiten",
  manage_roles: "Rollen verwalten",
  assign_roles: "Rollen zuweisen",
  manage_events: "Events verwalten",
};
const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS);

const TABS = [
  { id: "members", label: "Mitglieder" },
  { id: "rules", label: "Regeln" },
  { id: "events", label: "Events" },
];

function formatEventDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

/**
 * "Meine Gilde"-Screen - MMOCore erlaubt nur eine Gilde pro Spieler (siehe
 * api/guilds.js), daher eine Detailansicht statt einer Liste. Mitgliedschaft
 * (Beitreten/Verlassen) bleibt In-Game; Beschreibung/Regeln/Rollen/Events
 * werden hier verwaltet, jeweils nur sichtbar/bearbeitbar entsprechend
 * `guild.myPermissions` (server-seitig ohnehin nochmal geprüft).
 */
export default function GuildListScreen({ navigation }) {
  const [token, setToken] = useState(null);
  const [guild, setGuild] = useState(undefined); // undefined = lädt, null = keine Gilde
  const [activeTab, setActiveTab] = useState("members");

  const [descEditorVisible, setDescEditorVisible] = useState(false);
  const [rulesEditorVisible, setRulesEditorVisible] = useState(false);
  const [roleEditorFor, setRoleEditorFor] = useState(undefined); // undefined=zu, null=neu, Rolle=bearbeiten
  const [assignRoleFor, setAssignRoleFor] = useState(null); // Mitglied, dem gerade eine Rolle zugewiesen wird
  const [eventEditorFor, setEventEditorFor] = useState(undefined); // undefined=zu, null=neu, Event=bearbeiten

  const reload = useCallback(async () => {
    const t = token ?? (await getStoredToken());
    if (!token) setToken(t);
    try {
      setGuild(await getMyGuild(t));
    } catch {
      setGuild(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (guild === undefined) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.gold} style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (!guild) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Meine Gilde</Text>
        <Text style={styles.placeholder}>
          Du bist noch in keiner Gilde. Tritt im Spiel einer Gilde bei, um sie hier zu sehen.
        </Text>
      </View>
    );
  }

  const perms = guild.myPermissions ?? [];
  const can = (permission) => perms.includes(permission);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.guildName}>[{guild.tag}] {guild.name}</Text>
        <Text style={styles.memberCount}>{guild.members.length} Mitglieder</Text>
      </View>

      <View style={styles.tabRail}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabBtnText, activeTab === tab.id && styles.tabBtnTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.tabContent}>
        {activeTab === "members" && (
          <MembersTab
            guild={guild}
            can={can}
            onAssignRole={(member) => setAssignRoleFor(member)}
            onManageRoles={() => setRoleEditorFor(null)}
            onEditRole={(role) => setRoleEditorFor(role)}
          />
        )}

        {activeTab === "rules" && (
          <View style={{ gap: spacing.md }}>
            <SectionCard
              title="Beschreibung"
              text={guild.description}
              emptyHint="Noch keine Beschreibung."
              editable={can("manage_description")}
              onEdit={() => setDescEditorVisible(true)}
            />
            <SectionCard
              title="Regeln"
              text={guild.rules}
              emptyHint="Noch keine Regeln festgelegt."
              editable={can("manage_rules")}
              onEdit={() => setRulesEditorVisible(true)}
            />
          </View>
        )}

        {activeTab === "events" && (
          <EventsTab
            guild={guild}
            can={can}
            onCreate={() => setEventEditorFor(null)}
            onEdit={(event) => setEventEditorFor(event)}
          />
        )}
      </ScrollView>

      <Pressable
        style={styles.chatButton}
        onPress={() => navigation.navigate("GuildChat", { guildName: guild.name })}
      >
        <Text style={styles.chatButtonText}>💬 Zum Gilden-Chat</Text>
      </Pressable>

      {descEditorVisible && (
        <TextEditModal
          title="Beschreibung bearbeiten"
          initialValue={guild.description ?? ""}
          maxLength={2000}
          onCancel={() => setDescEditorVisible(false)}
          onSave={async (value) => {
            setGuild(await updateGuildDescription(token, value));
            setDescEditorVisible(false);
          }}
        />
      )}

      {rulesEditorVisible && (
        <TextEditModal
          title="Regeln bearbeiten"
          initialValue={guild.rules ?? ""}
          maxLength={5000}
          onCancel={() => setRulesEditorVisible(false)}
          onSave={async (value) => {
            setGuild(await updateGuildRules(token, value));
            setRulesEditorVisible(false);
          }}
        />
      )}

      {roleEditorFor !== undefined && (
        <RoleEditorModal
          role={roleEditorFor}
          onCancel={() => setRoleEditorFor(undefined)}
          onSave={async ({ name, tagPrefix, permissions }) => {
            if (roleEditorFor) {
              await updateGuildRole(token, roleEditorFor.id, { name, tagPrefix, permissions });
            } else {
              await createGuildRole(token, { name, tagPrefix, permissions });
            }
            setGuild(await getMyGuild(token));
            setRoleEditorFor(undefined);
          }}
          onDelete={
            roleEditorFor && !roleEditorFor.isDefault
              ? async () => {
                  await deleteGuildRole(token, roleEditorFor.id);
                  setGuild(await getMyGuild(token));
                  setRoleEditorFor(undefined);
                }
              : null
          }
        />
      )}

      {assignRoleFor && (
        <RoleAssignModal
          member={assignRoleFor}
          roles={guild.roles}
          onCancel={() => setAssignRoleFor(null)}
          onAssign={async (roleId) => {
            setGuild(await assignMemberRole(token, assignRoleFor.uuid, roleId));
            setAssignRoleFor(null);
          }}
        />
      )}

      {eventEditorFor !== undefined && (
        <EventEditorModal
          event={eventEditorFor}
          onCancel={() => setEventEditorFor(undefined)}
          onSave={async ({ title, description, startsAt }) => {
            if (eventEditorFor) {
              await updateGuildEvent(token, eventEditorFor.id, { title, description, startsAt });
            } else {
              await createGuildEvent(token, { title, description, startsAt });
            }
            setGuild(await getMyGuild(token));
            setEventEditorFor(undefined);
          }}
          onDelete={
            eventEditorFor
              ? async () => {
                  await deleteGuildEvent(token, eventEditorFor.id);
                  setGuild(await getMyGuild(token));
                  setEventEditorFor(undefined);
                }
              : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function MembersTab({ guild, can, onAssignRole, onManageRoles, onEditRole }) {
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        {guild.members.map((member) => (
          <Pressable
            key={member.uuid}
            style={styles.memberRow}
            disabled={!can("assign_roles") || member.isOwner}
            onPress={() => onAssignRole(member)}
          >
            <Text style={styles.memberName}>
              {member.isOwner
                ? "👑 "
                : member.role?.tagPrefix
                ? `[${member.role.tagPrefix}] `
                : ""}
              {member.username}
            </Text>
            <Text style={styles.memberRole}>{member.isOwner ? "Inhaber" : member.role?.name ?? ""}</Text>
          </Pressable>
        ))}
      </View>

      {can("manage_roles") && (
        <View style={{ gap: spacing.sm }}>
          <View style={styles.rolesHeaderRow}>
            <Text style={styles.subheading}>Rollen verwalten</Text>
            <Pressable onPress={onManageRoles}>
              <Text style={styles.addLink}>+ Neue Rolle</Text>
            </Pressable>
          </View>
          {guild.roles.map((role) => (
            <Pressable key={role.id} style={styles.roleRow} onPress={() => onEditRole(role)}>
              <Text style={styles.roleName}>
                {role.tagPrefix ? `[${role.tagPrefix}] ` : ""}
                {role.name}
                {role.isDefault ? " (Standard)" : ""}
              </Text>
              <Text style={styles.rolePerms}>{role.permissions.length} Rechte</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function SectionCard({ title, text, emptyHint, editable, onEdit }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.subheading}>{title}</Text>
        {editable && (
          <Pressable onPress={onEdit}>
            <Text style={styles.addLink}>Bearbeiten</Text>
          </Pressable>
        )}
      </View>
      <Text style={text ? styles.cardText : styles.placeholder}>{text || emptyHint}</Text>
    </View>
  );
}

function EventsTab({ guild, can, onCreate, onEdit }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {can("manage_events") && (
        <Pressable style={styles.createEventBtn} onPress={onCreate}>
          <Text style={styles.addLink}>+ Neues Event</Text>
        </Pressable>
      )}

      {guild.events.length === 0 && <Text style={styles.placeholder}>Noch keine Events geplant.</Text>}

      {guild.events.map((event) => (
        <Pressable
          key={event.id}
          style={styles.card}
          disabled={!can("manage_events")}
          onPress={() => onEdit(event)}
        >
          <Text style={styles.subheading}>{event.title}</Text>
          {event.startsAt && <Text style={styles.eventDate}>{formatEventDate(event.startsAt)}</Text>}
          {event.description && <Text style={styles.cardText}>{event.description}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

function ModalShell({ title, children, onCancel }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <Text style={styles.modalTitle}>{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function TextEditModal({ title, initialValue, maxLength, onCancel, onSave }) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  return (
    <ModalShell title={title} onCancel={onCancel}>
      <TextInput
        style={styles.textArea}
        value={value}
        onChangeText={setValue}
        multiline
        maxLength={maxLength}
        placeholder="…"
        placeholderTextColor={colors.textMuted}
      />
      <View style={styles.modalActions}>
        <Pressable style={styles.modalBtnSecondary} onPress={onCancel}>
          <Text style={styles.modalBtnSecondaryText}>Abbrechen</Text>
        </Pressable>
        <Pressable
          style={styles.modalBtnPrimary}
          disabled={saving}
          onPress={async () => {
            setSaving(true);
            try {
              await onSave(value);
            } finally {
              setSaving(false);
            }
          }}
        >
          <Text style={styles.modalBtnPrimaryText}>{saving ? "Speichert…" : "Speichern"}</Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}

function RoleEditorModal({ role, onCancel, onSave, onDelete }) {
  const [name, setName] = useState(role?.name ?? "");
  const [tagPrefix, setTagPrefix] = useState(role?.tagPrefix ?? "");
  const [permissions, setPermissions] = useState(new Set(role?.permissions ?? []));
  const [saving, setSaving] = useState(false);

  function togglePermission(p) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  return (
    <ModalShell title={role ? "Rolle bearbeiten" : "Neue Rolle"} onCancel={onCancel}>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Name (z.B. Offizier)"
        placeholderTextColor={colors.textMuted}
        maxLength={30}
      />
      <TextInput
        style={styles.input}
        value={tagPrefix}
        onChangeText={setTagPrefix}
        placeholder="Tag-Präfix (z.B. Off)"
        placeholderTextColor={colors.textMuted}
        maxLength={10}
      />

      <Text style={styles.subheading}>Rechte</Text>
      {ALL_PERMISSIONS.map((p) => (
        <Pressable key={p} style={styles.permissionRow} onPress={() => togglePermission(p)}>
          <Text style={styles.permissionCheck}>{permissions.has(p) ? "☑" : "☐"}</Text>
          <Text style={styles.permissionLabel}>{PERMISSION_LABELS[p]}</Text>
        </Pressable>
      ))}

      <View style={styles.modalActions}>
        {onDelete && (
          <Pressable style={styles.modalBtnDanger} onPress={onDelete}>
            <Text style={styles.modalBtnDangerText}>Löschen</Text>
          </Pressable>
        )}
        <Pressable style={styles.modalBtnSecondary} onPress={onCancel}>
          <Text style={styles.modalBtnSecondaryText}>Abbrechen</Text>
        </Pressable>
        <Pressable
          style={styles.modalBtnPrimary}
          disabled={saving || !name.trim()}
          onPress={async () => {
            setSaving(true);
            try {
              await onSave({ name: name.trim(), tagPrefix: tagPrefix.trim() || null, permissions: Array.from(permissions) });
            } finally {
              setSaving(false);
            }
          }}
        >
          <Text style={styles.modalBtnPrimaryText}>{saving ? "Speichert…" : "Speichern"}</Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}

function RoleAssignModal({ member, roles, onCancel, onAssign }) {
  return (
    <ModalShell title={`Rolle für ${member.username}`} onCancel={onCancel}>
      {roles.map((role) => (
        <Pressable key={role.id} style={styles.roleRow} onPress={() => onAssign(role.id)}>
          <Text style={styles.roleName}>{role.tagPrefix ? `[${role.tagPrefix}] ` : ""}{role.name}</Text>
          {member.role?.id === role.id && <Text style={styles.roleCurrentBadge}>Aktuell</Text>}
        </Pressable>
      ))}
      <View style={styles.modalActions}>
        <Pressable style={styles.modalBtnSecondary} onPress={onCancel}>
          <Text style={styles.modalBtnSecondaryText}>Abbrechen</Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}

function EventEditorModal({ event, onCancel, onSave, onDelete }) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startsAt, setStartsAt] = useState(
    event?.startsAt ? new Date(event.startsAt).toISOString().slice(0, 16).replace("T", " ") : ""
  );
  const [saving, setSaving] = useState(false);

  return (
    <ModalShell title={event ? "Event bearbeiten" : "Neues Event"} onCancel={onCancel}>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Titel"
        placeholderTextColor={colors.textMuted}
        maxLength={80}
      />
      <TextInput
        style={styles.input}
        value={startsAt}
        onChangeText={setStartsAt}
        placeholder="Datum/Zeit (JJJJ-MM-TT HH:mm), optional"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={styles.textArea}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Beschreibung (optional)"
        placeholderTextColor={colors.textMuted}
        maxLength={2000}
      />

      <View style={styles.modalActions}>
        {onDelete && (
          <Pressable style={styles.modalBtnDanger} onPress={onDelete}>
            <Text style={styles.modalBtnDangerText}>Löschen</Text>
          </Pressable>
        )}
        <Pressable style={styles.modalBtnSecondary} onPress={onCancel}>
          <Text style={styles.modalBtnSecondaryText}>Abbrechen</Text>
        </Pressable>
        <Pressable
          style={styles.modalBtnPrimary}
          disabled={saving || !title.trim()}
          onPress={async () => {
            setSaving(true);
            try {
              const iso = startsAt.trim() ? new Date(startsAt.trim().replace(" ", "T")).toISOString() : null;
              await onSave({ title: title.trim(), description: description.trim() || null, startsAt: iso });
            } finally {
              setSaving(false);
            }
          }}
        >
          <Text style={styles.modalBtnPrimaryText}>{saving ? "Speichert…" : "Speichern"}</Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 22, fontWeight: "800", color: colors.gold, marginTop: 60, marginHorizontal: spacing.lg },
  placeholder: { color: colors.textMuted, marginHorizontal: spacing.lg, fontSize: 13 },
  guildName: { fontSize: 20, fontWeight: "800", color: colors.gold },
  memberCount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  tabRail: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  tabBtn: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.goldSoft },
  tabBtnActive: { backgroundColor: colors.gold },
  tabBtnText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  tabBtnTextActive: { color: colors.bg },

  tabContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  memberName: { fontSize: 13, fontWeight: "700", color: colors.text },
  memberRole: { fontSize: 11, color: colors.textMuted },

  subheading: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", color: colors.gold },
  rolesHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addLink: { fontSize: 12, fontWeight: "700", color: colors.primary },

  roleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  roleName: { fontSize: 13, fontWeight: "700", color: colors.text },
  rolePerms: { fontSize: 11, color: colors.textMuted },
  roleCurrentBadge: { fontSize: 10, fontWeight: "800", color: colors.gold },

  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    gap: spacing.xs,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  eventDate: { fontSize: 11, color: colors.gold, fontWeight: "700" },
  createEventBtn: { alignSelf: "flex-start" },

  chatButton: {
    margin: spacing.lg,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  chatButtonText: { color: colors.bg, fontWeight: "800" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.lg },
  modalPanel: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: "85%",
  },
  modalTitle: { fontSize: 15, fontWeight: "800", color: colors.gold, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 13,
  },
  textArea: {
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 100,
    textAlignVertical: "top",
  },
  permissionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  permissionCheck: { fontSize: 16, color: colors.gold },
  permissionLabel: { fontSize: 12, color: colors.text },

  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.sm },
  modalBtnPrimary: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  modalBtnPrimaryText: { color: colors.bg, fontWeight: "800", fontSize: 12 },
  modalBtnSecondary: { paddingHorizontal: spacing.md, paddingVertical: 8 },
  modalBtnSecondaryText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  modalBtnDanger: { paddingHorizontal: spacing.md, paddingVertical: 8, marginRight: "auto" },
  modalBtnDangerText: { color: colors.danger, fontWeight: "700", fontSize: 12 },
});
