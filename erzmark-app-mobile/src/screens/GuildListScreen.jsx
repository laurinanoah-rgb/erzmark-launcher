import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet, Modal, TextInput, ScrollView, FlatList, ActivityIndicator, Animated, Easing, Dimensions, Keyboard, BackHandler, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
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
  getGuildChatHistory,
  sendGuildChatMessage,
  uploadGuildBanner,
  removeGuildBanner,
  uploadGuildLogo,
  removeGuildLogo,
  getGuildFeed,
  createGuildPost,
  deleteGuildPost,
  toggleGuildPostPin,
  toggleGuildPostReaction,
  createGuildPostComment,
  deleteGuildPostComment,
} from "../api/guilds";
import { getStoredToken, getAccountUuid } from "../api/auth";
import { colors, radius, spacing } from "../theme";

const PERMISSION_LABELS = {
  manage_description: "Beschreibung bearbeiten",
  manage_rules: "Regeln bearbeiten",
  manage_roles: "Rollen verwalten",
  assign_roles: "Rollen zuweisen",
  manage_events: "Events verwalten",
  manage_posts: "Pinnwand moderieren",
  manage_appearance: "Erscheinungsbild (Titelbild/Logo)",
};
const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS);

// "Einstellungen" ist nur sichtbar, wenn mindestens eines dieser Rechte
// vorliegt (der Owner hat laut Backend ohnehin implizit alle, siehe
// GuildController::requireGuildWithPermission()).
const TABS = [
  { id: "overview", label: "Übersicht", icon: "🏠" },
  { id: "posts", label: "Pinnwand", icon: "📌" },
  { id: "members", label: "Mitglieder", icon: "👥" },
  { id: "rules", label: "Regeln", icon: "📜" },
  { id: "events", label: "Events", icon: "📅" },
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "settings", label: "Einstellungen", icon: "⚙️", requiresAnyPermission: true },
];

function formatEventDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

/** Wrapper, der Kinder gestaffelt (per `index`) einfaden/einrutschen lässt - gleiches Muster wie ProfileSelectScreen/ProfileScreen/FriendsScreen. */
function FadeInItem({ index = 0, children, style }) {
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 340,
      delay: Math.min(index, 10) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: entrance,
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * "Meine Gilde"-Screen - MMOCore erlaubt nur eine Gilde pro Spieler (siehe
 * api/guilds.js), daher eine Detailansicht statt einer Liste. Mitgliedschaft
 * (Beitreten/Verlassen) bleibt In-Game; Beschreibung/Regeln/Rollen/Events
 * werden hier verwaltet, jeweils nur sichtbar/bearbeitbar entsprechend
 * `guild.myPermissions` (server-seitig ohnehin nochmal geprüft).
 *
 * Design (19.07.2026) nach Facebook-Gruppen-Vorbild: fester Tab-Kopf
 * (Mitglieder/Regeln/Events, jeweils mit Icon), animierter Crossfade+Slide
 * beim Tab-Wechsel, Editier-Dialoge als von unten einfahrende Bottom-Sheets
 * statt zentrierter Fenster - der Gildeninhaber (und wer die passende Rolle/
 * Berechtigung hat) kann so jeden Bereich direkt an Ort und Stelle bearbeiten.
 */
export default function GuildListScreen() {
  const [token, setToken] = useState(null);
  const [myUuid, setMyUuid] = useState(null);
  const [guild, setGuild] = useState(undefined); // undefined = lädt, null = keine Gilde
  const [activeTab, setActiveTab] = useState("overview");
  const [tabDirection, setTabDirection] = useState(1);

  const [descEditorVisible, setDescEditorVisible] = useState(false);
  const [rulesEditorVisible, setRulesEditorVisible] = useState(false);
  const [roleEditorFor, setRoleEditorFor] = useState(undefined); // undefined=zu, null=neu, Rolle=bearbeiten
  const [assignRoleFor, setAssignRoleFor] = useState(null); // Mitglied, dem gerade eine Rolle zugewiesen wird
  const [eventEditorFor, setEventEditorFor] = useState(undefined); // undefined=zu, null=neu, Event=bearbeiten

  const headerFade = useRef(new Animated.Value(0)).current;
  const tabTransition = useRef(new Animated.Value(1)).current;

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
    getAccountUuid().then(setMyUuid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (guild) {
      Animated.timing(headerFade, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!guild]);

  function switchTab(tabId) {
    if (tabId === activeTab) return;
    const fromIndex = TABS.findIndex((t) => t.id === activeTab);
    const toIndex = TABS.findIndex((t) => t.id === tabId);
    setTabDirection(toIndex > fromIndex ? 1 : -1);
    setActiveTab(tabId);
    tabTransition.setValue(0);
    Animated.timing(tabTransition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

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
  const hasSettingsAccess = ALL_PERMISSIONS.some(can);
  const visibleTabs = TABS.filter((tab) => !tab.requiresAnyPermission || hasSettingsAccess);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Animated.View
        style={[
          styles.header,
          { opacity: headerFade, transform: [{ translateY: headerFade.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] },
        ]}
      >
        <View style={styles.headerAccent} />
        <Text style={styles.guildName}>[{guild.tag}] {guild.name}</Text>
        <Text style={styles.memberCount}>{guild.members.length} Mitglieder</Text>
      </Animated.View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRailScroll} contentContainerStyle={styles.tabRail}>
        {visibleTabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
            onPress={() => switchTab(tab.id)}
          >
            <Text style={styles.tabBtnIcon}>{tab.icon}</Text>
            <Text style={[styles.tabBtnText, activeTab === tab.id && styles.tabBtnTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Animated.View
        style={{
          flex: 1,
          opacity: tabTransition,
          transform: [
            { translateX: tabTransition.interpolate({ inputRange: [0, 1], outputRange: [18 * tabDirection, 0] }) },
          ],
        }}
      >
        {activeTab === "chat" ? (
          <GuildChatPanel token={token} />
        ) : activeTab === "posts" ? (
          <GuildPostsTab token={token} myUuid={myUuid} can={can} />
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.tabContent} key={activeTab}>
            {activeTab === "overview" && <OverviewTab guild={guild} />}

            {activeTab === "members" && (
              <MembersTab guild={guild} can={can} onAssignRole={(member) => setAssignRoleFor(member)} />
            )}

            {activeTab === "rules" && (
              <View style={{ gap: spacing.md }}>
                <FadeInItem index={0}>
                  <SectionCard
                    title="Beschreibung"
                    text={guild.description}
                    emptyHint="Noch keine Beschreibung."
                    editable={can("manage_description")}
                    onEdit={() => setDescEditorVisible(true)}
                  />
                </FadeInItem>
                <FadeInItem index={1}>
                  <SectionCard
                    title="Regeln"
                    text={guild.rules}
                    emptyHint="Noch keine Regeln festgelegt."
                    editable={can("manage_rules")}
                    onEdit={() => setRulesEditorVisible(true)}
                  />
                </FadeInItem>
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

            {activeTab === "settings" && (
              <SettingsTab
                guild={guild}
                token={token}
                can={can}
                onGuildUpdated={setGuild}
                onEditDescription={() => setDescEditorVisible(true)}
                onEditRules={() => setRulesEditorVisible(true)}
                onManageRoles={() => setRoleEditorFor(null)}
                onEditRole={(role) => setRoleEditorFor(role)}
              />
            )}
          </ScrollView>
        )}
      </Animated.View>

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

/**
 * `member.username` kommt 1:1 vom Backend (`GuildController::mine()` liest
 * die MMOCore-Gilden-YAML direkt) - aktuell noch der rohe Minecraft-
 * Accountname, NICHT der aktive MMOProfiles-Charaktername. Nutzerwunsch
 * (19.07.2026): stattdessen den Profilnamen anzeigen - das ist eine
 * serverseitige Änderung (GuildController.php auf dem Hetzner-Server muss
 * den Account-UUID -> aktiver-Profilname-Lookup ergänzen), noch nicht
 * umgesetzt. Siehe HANDOFF.md TODO-Liste.
 */
function MembersTab({ guild, can, onAssignRole }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {guild.members.map((member, index) => (
        <FadeInItem key={member.uuid} index={index}>
          <Pressable
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
        </FadeInItem>
      ))}
    </View>
  );
}

/**
 * "Übersicht"-Tab, angelehnt an die Startseite einer Facebook-Gruppe:
 * Titelbild/Logo (sobald das Backend sie liefert, siehe HANDOFF.md TODO
 * "Titelbild/Logo für Gilden") + Beschreibung auf einen Blick. Solange
 * `guild.bannerUrl`/`guild.logoUrl` noch nicht existieren, zeigt ein
 * dezenter Platzhalter trotzdem Tag/Name - kein kaputtes Bild, kein leerer
 * Bereich.
 */
function OverviewTab({ guild }) {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.banner}>
        {guild.bannerUrl && <Image source={{ uri: guild.bannerUrl }} style={StyleSheet.absoluteFill} />}
        <View style={styles.bannerOverlay}>
          <View style={styles.logoRing}>
            {guild.logoUrl ? (
              <Image source={{ uri: guild.logoUrl }} style={styles.logoImage} />
            ) : (
              <Text style={styles.logoFallback}>{guild.tag?.slice(0, 3)}</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statPillValue}>{guild.members.length}</Text>
          <Text style={styles.statPillLabel}>Mitglieder</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statPillValue}>{guild.roles.length}</Text>
          <Text style={styles.statPillLabel}>Rollen</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statPillValue}>{guild.events.length}</Text>
          <Text style={styles.statPillLabel}>Events</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.subheading}>Über die Gilde</Text>
        <Text style={guild.description ? styles.cardText : styles.placeholder}>
          {guild.description || "Noch keine Beschreibung - unter Regeln oder Einstellungen bearbeitbar."}
        </Text>
      </View>
    </View>
  );
}

/**
 * Owner/Admin-Bereich, gebündelt statt über den ganzen Screen verteilt -
 * einziger Ort für Beschreibung/Regeln, Titelbild/Logo und Gilden-Team.
 * Nur sichtbar, wenn mindestens ein `manage_*`-Recht vorliegt (siehe
 * `hasSettingsAccess` in GuildListScreen).
 */
/** Eine Zeile in "Erscheinungsbild": Vorschau + Hochladen/Ändern/Entfernen. */
function AppearanceUploadRow({ label, imageUrl, canManage, uploading, onPick, onRemove }) {
  return (
    <View style={styles.appearanceRow}>
      <View style={styles.appearancePreview}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.appearanceImage} />
        ) : (
          <Text style={styles.appearancePlaceholderText}>Kein Bild</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.cardText}>{label}</Text>
        {canManage ? (
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Pressable onPress={onPick} disabled={uploading}>
              <Text style={styles.addLink}>{uploading ? "Lädt hoch…" : imageUrl ? "Ändern" : "Hochladen"}</Text>
            </Pressable>
            {imageUrl && !uploading && (
              <Pressable onPress={onRemove}>
                <Text style={styles.dangerLink}>Entfernen</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Text style={styles.placeholder}>Nur für Berechtigte änderbar.</Text>
        )}
      </View>
    </View>
  );
}

function SettingsTab({ guild, token, can, onGuildUpdated, onEditDescription, onEditRules, onManageRoles, onEditRole }) {
  const [uploadingField, setUploadingField] = useState(null); // "banner" | "logo" | null
  const [uploadError, setUploadError] = useState(null);
  const canManageAppearance = can("manage_appearance");

  async function pickAndUpload(field) {
    setUploadError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadError("Zugriff auf Fotos wurde nicht erlaubt - in den Handy-Einstellungen aktivierbar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: field === "banner" ? [16, 9] : [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingField(field);
    try {
      const updated =
        field === "banner"
          ? await uploadGuildBanner(token, result.assets[0])
          : await uploadGuildLogo(token, result.assets[0]);
      onGuildUpdated(updated);
    } catch (err) {
      setUploadError(err?.message ?? String(err));
    } finally {
      setUploadingField(null);
    }
  }

  async function removeImage(field) {
    setUploadError(null);
    setUploadingField(field);
    try {
      const updated = field === "banner" ? await removeGuildBanner(token) : await removeGuildLogo(token);
      onGuildUpdated(updated);
    } catch (err) {
      setUploadError(err?.message ?? String(err));
    } finally {
      setUploadingField(null);
    }
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.subheading}>Erscheinungsbild</Text>
        <AppearanceUploadRow
          label="Titelbild"
          imageUrl={guild.bannerUrl}
          canManage={canManageAppearance}
          uploading={uploadingField === "banner"}
          onPick={() => pickAndUpload("banner")}
          onRemove={() => removeImage("banner")}
        />
        <AppearanceUploadRow
          label="Gilden-Logo"
          imageUrl={guild.logoUrl}
          canManage={canManageAppearance}
          uploading={uploadingField === "logo"}
          onPick={() => pickAndUpload("logo")}
          onRemove={() => removeImage("logo")}
        />
        {uploadError && <Text style={styles.error}>{uploadError}</Text>}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={styles.subheading}>Inhalte</Text>
        <SectionCard
          title="Beschreibung"
          text={guild.description}
          emptyHint="Noch keine Beschreibung."
          editable={can("manage_description")}
          onEdit={onEditDescription}
        />
        <SectionCard
          title="Regeln"
          text={guild.rules}
          emptyHint="Noch keine Regeln festgelegt."
          editable={can("manage_rules")}
          onEdit={onEditRules}
        />
      </View>

      {can("manage_roles") && (
        <View style={{ gap: spacing.sm }}>
          <View style={styles.rolesHeaderRow}>
            <Text style={styles.subheading}>Gilden-Team verwalten</Text>
            <Pressable onPress={onManageRoles}>
              <Text style={styles.addLink}>+ Neue Rolle</Text>
            </Pressable>
          </View>
          {guild.roles.map((role, index) => (
            <FadeInItem key={role.id} index={index}>
              <Pressable style={styles.roleRow} onPress={() => onEditRole(role)}>
                <Text style={styles.roleName}>
                  {role.tagPrefix ? `[${role.tagPrefix}] ` : ""}
                  {role.name}
                  {role.isDefault ? " (Standard)" : ""}
                </Text>
                <Text style={styles.rolePerms}>{role.permissions.length} Rechte</Text>
              </Pressable>
            </FadeInItem>
          ))}
        </View>
      )}
    </View>
  );
}

/** Eine Beitragskarte auf der Pinnwand inkl. Reaktion, Kommentare (auf-/zuklappbar), Anpinnen/Löschen. */
function GuildPostCard({
  post,
  index,
  myUuid,
  canManagePosts,
  expanded,
  commentDraft,
  onToggleExpanded,
  onReact,
  onTogglePin,
  onDelete,
  onCommentDraftChange,
  onAddComment,
  onDeleteComment,
}) {
  const isAuthor = post.authorUuid === myUuid;

  return (
    <FadeInItem index={index} style={styles.postCard}>
      {post.isPinned && <Text style={styles.pinnedBadge}>📌 Angepinnt</Text>}
      <View style={styles.postHeaderRow}>
        <Text style={styles.postAuthor}>{post.author}</Text>
        <Text style={styles.postDate}>{formatEventDate(post.createdAt)}</Text>
      </View>
      {post.content && <Text style={styles.cardText}>{post.content}</Text>}
      {post.imageUrl && <Image source={{ uri: post.imageUrl }} style={styles.postImage} />}

      <View style={styles.postActionsRow}>
        <Pressable onPress={onReact} style={styles.postActionBtn}>
          <Text style={[styles.postActionText, post.myReaction && styles.postActionActive]}>
            {post.myReaction ? "❤️" : "🤍"} {post.reactionsCount}
          </Text>
        </Pressable>
        <Pressable onPress={onToggleExpanded} style={styles.postActionBtn}>
          <Text style={styles.postActionText}>💬 {post.comments.length}</Text>
        </Pressable>
        {canManagePosts && (
          <Pressable onPress={onTogglePin} style={styles.postActionBtn}>
            <Text style={styles.postActionText}>{post.isPinned ? "Loslösen" : "Anpinnen"}</Text>
          </Pressable>
        )}
        {(isAuthor || canManagePosts) && (
          <Pressable onPress={onDelete} style={styles.postActionBtn}>
            <Text style={styles.dangerLink}>Löschen</Text>
          </Pressable>
        )}
      </View>

      {expanded && (
        <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
          {post.comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.commentAuthor}>{c.author}</Text>
                <Text style={styles.commentText}>{c.content}</Text>
              </View>
              {(c.authorUuid === myUuid || canManagePosts) && (
                <Pressable onPress={() => onDeleteComment(c.id)}>
                  <Text style={styles.dangerLink}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}
          <View style={styles.commentComposerRow}>
            <TextInput
              style={styles.commentInput}
              value={commentDraft}
              onChangeText={onCommentDraftChange}
              placeholder="Kommentieren…"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable onPress={onAddComment}>
              <Text style={styles.addLink}>Senden</Text>
            </Pressable>
          </View>
        </View>
      )}
    </FadeInItem>
  );
}

/**
 * Gilden-Pinnwand (19.07.2026) - Server-Endpunkte (`feed`/`storePost`/...)
 * existierten schon seit 18.07.2026, waren aber nie in der App verdrahtet.
 * Facebook-Gruppen-Vorbild: bleibende Beiträge mit Bild/Reaktion/Kommentaren,
 * im Gegensatz zum flüchtigen Chat-Tab. Eigene FlatList statt in die
 * gemeinsame ScrollView eingebettet (verschachtelte scrollbare Listen sind
 * in RN problematisch), analog zu GuildChatPanel.
 */
function GuildPostsTab({ token, myUuid, can }) {
  const [posts, setPosts] = useState(undefined);
  const [composerText, setComposerText] = useState("");
  const [composerImage, setComposerImage] = useState(null);
  const [posting, setPosting] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [expandedPostId, setExpandedPostId] = useState(null);
  const canManagePosts = can("manage_posts");

  const reload = useCallback(() => {
    if (!token) return;
    getGuildFeed(token).then(setPosts).catch(() => setPosts([]));
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function pickComposerImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) setComposerImage(result.assets[0]);
  }

  async function handlePost() {
    if (!composerText.trim() && !composerImage) return;
    setPosting(true);
    try {
      const post = await createGuildPost(token, { content: composerText.trim() || null, imageAsset: composerImage });
      setPosts((prev) => [post, ...(prev ?? [])]);
      setComposerText("");
      setComposerImage(null);
    } finally {
      setPosting(false);
    }
  }

  async function handleDeletePost(postId) {
    await deleteGuildPost(token, postId);
    setPosts((prev) => (prev ?? []).filter((p) => p.id !== postId));
  }

  async function handleTogglePin(postId) {
    await toggleGuildPostPin(token, postId);
    reload(); // Reihenfolge kann sich aendern (angepinnte Beitraege zuerst) - einfacher Neu-Fetch statt manueller Neusortierung
  }

  async function handleReact(post) {
    setPosts((prev) =>
      (prev ?? []).map((p) =>
        p.id === post.id
          ? { ...p, myReaction: !p.myReaction, reactionsCount: p.reactionsCount + (p.myReaction ? -1 : 1) }
          : p
      )
    );
    try {
      const result = await toggleGuildPostReaction(token, post.id);
      setPosts((prev) =>
        (prev ?? []).map((p) => (p.id === post.id ? { ...p, myReaction: result.myReaction, reactionsCount: result.reactionsCount } : p))
      );
    } catch {
      // Fehlschlag -> auf den Stand vor dem optimistischen Update zurueckfallen
      setPosts((prev) =>
        (prev ?? []).map((p) => (p.id === post.id ? { ...p, myReaction: post.myReaction, reactionsCount: post.reactionsCount } : p))
      );
    }
  }

  async function handleAddComment(postId) {
    const content = (commentDrafts[postId] ?? "").trim();
    if (!content) return;
    const comment = await createGuildPostComment(token, postId, content);
    setPosts((prev) => (prev ?? []).map((p) => (p.id === postId ? { ...p, comments: [...p.comments, comment] } : p)));
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
  }

  async function handleDeleteComment(postId, commentId) {
    await deleteGuildPostComment(token, commentId);
    setPosts((prev) =>
      (prev ?? []).map((p) => (p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p))
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {posts === undefined ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.tabContent}
          ListHeaderComponent={
            <View style={styles.composerCard}>
              <TextInput
                style={styles.textArea}
                placeholder="Was gibt's Neues in der Gilde?"
                placeholderTextColor={colors.textMuted}
                value={composerText}
                onChangeText={setComposerText}
                multiline
                maxLength={3000}
              />
              {composerImage && (
                <View style={styles.composerImageWrap}>
                  <Image source={{ uri: composerImage.uri }} style={styles.composerImage} />
                  <Pressable style={styles.composerImageRemove} onPress={() => setComposerImage(null)}>
                    <Text style={styles.composerImageRemoveText}>✕</Text>
                  </Pressable>
                </View>
              )}
              <View style={styles.composerActionsRow}>
                <Pressable onPress={pickComposerImage}>
                  <Text style={styles.addLink}>🖼 Bild</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtnPrimary, (posting || (!composerText.trim() && !composerImage)) && styles.btnDisabled]}
                  onPress={handlePost}
                  disabled={posting || (!composerText.trim() && !composerImage)}
                >
                  <Text style={styles.modalBtnPrimaryText}>{posting ? "Postet…" : "Posten"}</Text>
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={styles.placeholder}>Noch keine Beiträge - schreib den ersten!</Text>}
          renderItem={({ item, index }) => (
            <GuildPostCard
              post={item}
              index={index}
              myUuid={myUuid}
              canManagePosts={canManagePosts}
              expanded={expandedPostId === item.id}
              commentDraft={commentDrafts[item.id] ?? ""}
              onToggleExpanded={() => setExpandedPostId((prev) => (prev === item.id ? null : item.id))}
              onReact={() => handleReact(item)}
              onTogglePin={() => handleTogglePin(item.id)}
              onDelete={() => handleDeletePost(item.id)}
              onCommentDraftChange={(text) => setCommentDrafts((prev) => ({ ...prev, [item.id]: text }))}
              onAddComment={() => handleAddComment(item.id)}
              onDeleteComment={(commentId) => handleDeleteComment(item.id, commentId)}
            />
          )}
        />
      )}
    </KeyboardAvoidingView>
  );
}

/**
 * Chat als eigener Tab statt separatem Button/Screen (19.07.2026) - eigene
 * FlatList statt in die gemeinsame ScrollView der anderen Tabs eingebettet
 * (verschachtelte scrollbare Listen sind in RN problematisch), volle Höhe +
 * KeyboardAvoidingView analog zu ModalShell, damit das Eingabefeld nicht
 * hinter der Tastatur verschwindet.
 */
function GuildChatPanel({ token }) {
  const [messages, setMessages] = useState(undefined);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token) return;
    getGuildChatHistory(token).then(setMessages).catch(() => setMessages([]));
  }, [token]);

  async function handleSend() {
    if (!draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft("");
    try {
      const sent = await sendGuildChatMessage(token, text);
      setMessages((prev) => [...(prev ?? []), sent]);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {messages === undefined ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.chatList}
          ListEmptyComponent={<Text style={styles.placeholder}>Noch keine Nachrichten - schreib die erste!</Text>}
          renderItem={({ item, index }) => (
            <FadeInItem index={index} style={styles.chatMessageRow}>
              <Text style={styles.chatAuthor}>{item.author}</Text>
              <Text style={styles.chatText}>{item.message}</Text>
            </FadeInItem>
          )}
        />
      )}
      <View style={styles.chatInputRow}>
        <TextInput
          style={styles.chatInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Nachricht schreiben…"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={styles.chatSendBtn} onPress={handleSend} disabled={sending}>
          <Text style={styles.chatSendBtnText}>{sending ? "…" : "Senden"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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

      {guild.events.map((event, index) => (
        <FadeInItem key={event.id} index={index}>
          <Pressable
            style={styles.card}
            disabled={!can("manage_events")}
            onPress={() => onEdit(event)}
          >
            <Text style={styles.subheading}>{event.title}</Text>
            {event.startsAt && <Text style={styles.eventDate}>{formatEventDate(event.startsAt)}</Text>}
            {event.description && <Text style={styles.cardText}>{event.description}</Text>}
          </Pressable>
        </FadeInItem>
      ))}
    </View>
  );
}

const SCREEN_HEIGHT = Dimensions.get("window").height;

/**
 * Editier-Dialoge als von unten einfahrendes Bottom-Sheet (statt zentriertem
 * Fenster) - modernere, "app-typische" Geste, Antippen des abgedunkelten
 * Hintergrunds schließt den Dialog wie erwartet.
 *
 * Bugfix (19.07.2026): Auf Android hat die Hardware-Zurück-Taste bisher
 * IMMER sofort den ganzen Dialog geschlossen (`onRequestClose`) - auch
 * während die Tastatur offen war, z.B. beim Tippen der Regeln. Ein Nutzer,
 * der die Tastatur mit Zurück schließen wollte (normales Android-Verhalten
 * auf einem gewöhnlichen Screen), hat damit stattdessen ungespeichert den
 * ganzen Dialog verloren - der "Speichern"-Button war praktisch
 * unerreichbar. Fix: Solange die Tastatur sichtbar ist, schließt Zurück nur
 * die Tastatur (Eingabe bleibt erhalten); erst ein zweiter Zurück-Druck
 * (ohne Tastatur) schließt den Dialog. Zusätzlich sorgt KeyboardAvoidingView
 * dafür, dass der "Speichern"-Button gar nicht erst hinter der Tastatur
 * verschwindet (Modals bekommen Androids adjustResize sonst nicht automatisch).
 */
function ModalShell({ title, children, onCancel }) {
  const backdropFade = useRef(new Animated.Value(0)).current;
  const sheetSlide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const keyboardVisible = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropFade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(sheetSlide, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }),
    ]).start();

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => { keyboardVisible.current = true; });
    const hideSub = Keyboard.addListener(hideEvent, () => { keyboardVisible.current = false; });

    const backSub = Platform.OS === "android"
      ? BackHandler.addEventListener("hardwareBackPress", () => {
          if (keyboardVisible.current) {
            Keyboard.dismiss();
            return true; // Zurück-Druck "verbraucht" - Dialog bleibt offen
          }
          return false; // keine Tastatur offen -> normales Verhalten (Dialog schließt)
        })
      : null;

    return () => {
      showSub.remove();
      hideSub.remove();
      backSub?.remove();
    };
  }, [backdropFade, sheetSlide]);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[styles.modalBackdrop, { opacity: backdropFade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalKeyboardWrap}
        >
          <Animated.View style={[styles.modalPanel, { transform: [{ translateY: sheetSlide }] }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{title}</Text>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
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
        placeholder="Name (z.B. Gilden-Team)"
        placeholderTextColor={colors.textMuted}
        maxLength={30}
      />
      <TextInput
        style={styles.input}
        value={tagPrefix}
        onChangeText={setTagPrefix}
        placeholder="Tag-Präfix (z.B. Team)"
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
  composerCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  composerActionsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  composerImageWrap: { alignSelf: "flex-start", position: "relative" },
  composerImage: { width: 96, height: 96, borderRadius: radius.sm, resizeMode: "cover" },
  composerImageRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  composerImageRemoveText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  btnDisabled: { opacity: 0.5 },

  postCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  pinnedBadge: { fontSize: 10, fontWeight: "800", color: colors.gold, letterSpacing: 0.4, textTransform: "uppercase" },
  postHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  postAuthor: { fontSize: 13, fontWeight: "800", color: colors.text },
  postDate: { fontSize: 11, color: colors.textMuted },
  postImage: { width: "100%", height: 180, borderRadius: radius.sm, resizeMode: "cover", marginTop: spacing.xs },
  postActionsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  postActionBtn: {},
  postActionText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  postActionActive: { color: colors.gold },

  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: 4 },
  commentAuthor: { fontSize: 11, fontWeight: "800", color: colors.gold },
  commentText: { fontSize: 12, color: colors.text },
  commentComposerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  commentInput: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: 12,
  },

  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  headerAccent: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.gold, marginTop: 60, marginHorizontal: spacing.lg },
  placeholder: { color: colors.textMuted, marginHorizontal: spacing.lg, fontSize: 13 },
  guildName: { fontSize: 22, fontWeight: "800", color: colors.gold },
  memberCount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  tabRailScroll: { flexGrow: 0, marginBottom: spacing.sm },
  tabRail: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  tabBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabBtnIcon: { fontSize: 13 },
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

  banner: {
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerOverlay: { alignItems: "center", justifyContent: "center" },
  logoRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
    borderWidth: 2,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
    overflow: "hidden",
  },
  logoImage: { width: 64, height: 64, resizeMode: "cover" },
  logoFallback: { fontSize: 18, fontWeight: "800", color: colors.gold, letterSpacing: 1 },

  statsRow: { flexDirection: "row", gap: spacing.sm },
  statPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  statPillValue: { fontSize: 16, fontWeight: "800", color: colors.text },
  statPillLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  appearanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  appearancePreview: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  appearanceImage: { width: "100%", height: "100%", resizeMode: "cover" },
  appearancePlaceholderText: { fontSize: 9, color: colors.textMuted, textAlign: "center" },
  dangerLink: { fontSize: 12, fontWeight: "700", color: colors.danger },
  error: { color: colors.danger, fontSize: 12 },

  chatList: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.xs, flexGrow: 1 },
  chatMessageRow: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  chatAuthor: { fontSize: 11, fontWeight: "800", color: colors.gold },
  chatText: { fontSize: 14, color: colors.text, marginTop: 2 },
  chatInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.goldSoft,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 13,
  },
  chatSendBtn: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: spacing.md, justifyContent: "center" },
  chatSendBtnText: { color: colors.bg, fontWeight: "800", fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalKeyboardWrap: { width: "100%" },
  modalPanel: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    borderBottomWidth: 0,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: "85%",
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.goldSoft,
    marginBottom: spacing.xs,
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
