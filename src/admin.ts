import { createClerkClient } from "@clerk/backend";

/** The one account that may open the admin page and start a research run by hand. */
const ADMIN_EMAIL = "oddofrancesco000@gmail.com";

export async function isAdmin(secretKey: string, userId: string): Promise<boolean> {
  const user = await createClerkClient({ secretKey }).users.getUser(userId);
  const primary = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);
  return primary?.verification?.status === "verified" && primary.emailAddress.toLowerCase() === ADMIN_EMAIL;
}
