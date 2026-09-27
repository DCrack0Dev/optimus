import { Client, Account, Databases } from "appwrite";

const client = new Client()
    .setEndpoint("https://fra.cloud.appwrite.io/v1")
    .setProject("dtws-web01");

const account = new Account(client);
const databases = new Databases(client);

// Ping the Appwrite backend server to verify the setup
client.ping().then(response => {
    console.log("Appwrite setup verified:", response);
}).catch(error => {
    console.error("Appwrite setup verification failed:", error);
});

export { client, account, databases };
