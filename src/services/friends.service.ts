import { Friends } from "@/models/friends.model";
import { FriendshipStatuses } from "@/models/friendship_statuses.model";

class FriendService {
  public async areFriends(userId1: number, userId2: number): Promise<boolean> {
    let lowerId = userId1 < userId2 ? userId1 : userId2;
    let higherId = userId1 > userId2 ? userId1 : userId2;
    let friendshipHash = `${lowerId}_${higherId}`;

    const fs = await FriendshipStatuses.query().whereNotDeleted().findOne({
      name: "Accepted",
    });
    if (!fs) throw new Error("Friendship status not found.");

    const friend = await Friends.query().whereNotDeleted().findOne({
      friendshipHash: friendshipHash,
      friendshipStatusId: fs.id,
    });

    return friend ? true : false;
  }
}

export default FriendService;
