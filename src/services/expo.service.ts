import { EXPO_ACCESS_TOKEN } from "@/config";
import { ExpoPushTokens } from "@/models/expo_push_tokens.model";
import Expo, { ExpoPushMessage } from "expo-server-sdk";

// Create a new Expo SDK client
// optionally providing an access token if you have enabled push security
let expo = new Expo({ accessToken: EXPO_ACCESS_TOKEN });

class ExpoService {
  public async sendSnapSyncAcceptedNotification(
    key: string,
    usersIds: number[],
    username: string
  ): Promise<void> {
    // Recupero gli expoPushTokens degli utenti
    let dbExpoPushTokens = await ExpoPushTokens.query().whereIn(
      "userId",
      usersIds
    );
    let expoPushTokens: string[] = dbExpoPushTokens.map((item) => item.token);

    // Create the messages that you want to send to clients
    let messages: ExpoPushMessage[] = [];

    for (let pushToken of expoPushTokens) {
      // Each push token looks like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]

      // Check that all your push tokens appear to be valid Expo push tokens
      if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} is not a valid Expo push token`);
        continue;
      }

      // Construct a message (see https://docs.expo.io/push-notifications/sending-notifications/)
      messages.push({
        to: pushToken,
        sound: "default",
        title: "SnapSync",
        body: `Click to sync with ${username}`,
        data: { key: key, type: "JOIN_SNAP" },
      });
    }

    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];
    (async () => {
      // Send the chunks to the Expo push notification service. There are
      // different strategies you could use. A simple one is to send one chunk at a
      // time, which nicely spreads the load out over time:
      for (let chunk of chunks) {
        try {
          let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          // console.log(ticketChunk);
          tickets.push(...ticketChunk);
          // NOTE: If a ticket contains an error code in ticket.details.error, you
          // must handle it appropriately. The error codes are listed in the Expo
          // documentation:
          // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
        } catch (error) {
          // console.error(error);
        }
      }
    })();
  }
}

export default ExpoService;
