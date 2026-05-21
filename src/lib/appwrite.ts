import { Client, Account, Databases } from "appwrite";

const client = new Client()
  .setEndpoint("https://sgp.cloud.appwrite.io/v1")
  .setProject("9706127862");

const account = new Account(client);
const databases = new Databases(client);

export { client, account, databases };
