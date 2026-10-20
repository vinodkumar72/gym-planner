import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { getDb } from '@/db/client';
import { getPreferences } from '@/db/repositories/preferencesRepo';

const REST_ID = 'rest-timer';
const REMINDER_PREFIX = 'workout-reminder-';
const REST_DAY_ID = 'rest-day-reminder';
const CHANNEL = 'workouts';

let handlerInstalled = false;

function installHandler() {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Workouts',
      importance: AndroidImportance.DEFAULT,
    });
  }
}

/** Requests permission only when the user turns reminders on. Returns whether granted. */
export async function requestPermission(): Promise<boolean> {
  installHandler();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

export async function hasPermission(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { hour: Math.min(23, Math.max(0, h ?? 17)), minute: Math.min(59, Math.max(0, m ?? 0)) };
}

/**
 * Schedules one weekly reminder per preferred training day (local only). Cancels previous reminders first
 * so toggling or changing days never stacks notifications.
 */
export async function syncReminders(): Promise<void> {
  const prefs = await getPreferences(getDb());
  await cancelReminders();
  if (!prefs.notificationsEnabled) return;
  if (!(await hasPermission())) return;
  installHandler();
  await ensureChannel();
  const { hour, minute } = parseTime(prefs.reminderTime);
  let days: number[] = [];
  try {
    days = JSON.parse(prefs.preferredTrainingDays) as number[];
  } catch {
    days = [1, 3, 5];
  }
  for (const d of days) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_PREFIX}${d}`,
      content: { title: 'Time to train', body: 'Open Gym Planner to see what to work on today.' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: d + 1, // expo uses 1 = Sunday
        hour,
        minute,
        channelId: CHANNEL,
      },
    });
  }
  if (prefs.restDayReminder) {
    const restDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !days.includes(d));
    for (const d of restDays) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${REST_DAY_ID}-${d}`,
        content: { title: 'Rest day', body: 'Recovery counts. Stretch, walk, and eat well.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: d + 1, hour, minute, channelId: CHANNEL },
      });
    }
  }
}

export async function cancelReminders(): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.identifier.startsWith(REMINDER_PREFIX) || n.identifier.startsWith(REST_DAY_ID)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // notifications unavailable (e.g. simulator) — nothing to cancel
  }
}

/** Rest timer alert; only fires if the user enabled notifications and granted permission. */
export async function scheduleRestNotification(endsAt: number): Promise<void> {
  try {
    const prefs = await getPreferences(getDb());
    if (!prefs.notificationsEnabled || !(await hasPermission())) return;
    installHandler();
    await ensureChannel();
    await Notifications.cancelScheduledNotificationAsync(REST_ID).catch(() => undefined);
    const seconds = Math.ceil((endsAt - Date.now()) / 1000);
    if (seconds <= 1) return;
    await Notifications.scheduleNotificationAsync({
      identifier: REST_ID,
      content: { title: 'Rest over', body: 'Next set.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false, channelId: CHANNEL },
    });
  } catch {
    // never let notification failures affect the workout
  }
}

export async function cancelRestNotification(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_ID);
  } catch {
    // ignore
  }
}
