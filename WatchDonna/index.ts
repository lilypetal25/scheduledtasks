import { AzureFunction, Context, Timer } from "@azure/functions"
import { BlobServiceClient, BlockBlobClient } from "@azure/storage-blob";
import got from "got";

type GetAvailableDatesRequest = {
    businessID: string,
    spID: string
}

type GetAvailableDatesResponse = {
    d: string[]
}

type SavedState = {
    knownDates: string[]
};

const timerTrigger: AzureFunction = async function (context: Context, myTimer: Timer): Promise<void> {
    const now = new Date();
    context.log('Script start: Checking whether Donna has posted any new dates of service.', now);

    if (myTimer.isPastDue) {
        context.log('Warning: isPastDue is set to true.');
    }

    const blobConnectionString = process.env.WatchDonnaStorageConnectionString;

    if (!blobConnectionString) {
        context.log.error("The WatchDonnaStorageConnectionString environment variable is not defined. Exiting.");
        return;
    }

    const blobClient = BlobServiceClient.fromConnectionString(blobConnectionString);

    const knownDates = await fetchKnownDates(context, blobClient);

    const requestBody: GetAvailableDatesRequest = {
        "businessID":"213133",
        "spID":""
    };

    const response: GetAvailableDatesResponse = await got.post("https://www.vagaro.com/us02/websiteapi/homepage/getavailabledates", { json: requestBody }).json();
    const responseDates = response.d.map(x => new Date(x)).filter(x => now < x).map(x => x.toDateString());

    context.log(`Received ${responseDates.length} dates from Vagaro. Checking for new entries...`);

    const newDates = responseDates.filter(x => !knownDates.has(x));

    if (newDates.length === 0) {
        context.log('Did not find any new dates of service.');
        return;
    }

    newDates.forEach(x => context.log(`Found new date of service: ${x}`));

    // Construct a new list of known dates, dropping any dates in the past and adding any new ones we discovered.
    const newKnownDates = new Set([
        ...Array.from(knownDates).filter(x => x && now < new Date(x)), // Include previously known dates, dropping dates in the past.
        ...newDates.values() // Include any newly discovered dates.
    ]);

    persistKnownDates(context, blobClient, newKnownDates);
};

export default timerTrigger;

async function fetchKnownDates(context: Context, blobClient: BlobServiceClient): Promise<Set<string>> {
    // const knownDateStrings = ["Nov 23,2022","Nov 25,2022","Nov 26,2022","Nov 30,2022","Dec 01,2022","Dec 02,2022","Dec 03,2022","Dec 07,2022","Dec 08,2022","Dec 09,2022","Dec 10,2022","Dec 12,2022","Dec 14,2022","Dec 15,2022","Dec 16,2022","Dec 17,2022","Dec 19,2022","Dec 20,2022","Dec 28,2022","Dec 29,2022","Dec 30,2022","Dec 31,2022"];
    // const knownDateStrings = ["Wed Jan 25 2023", "Thu Jan 26 2023", "Fri Jan 27 2023", "Sat Jan 28 2023", "Wed Feb 01 2023", "Thu Feb 02 2023", "Fri Feb 03 2023", "Sat Feb 04 2023", "Thu Feb 09 2023", "Fri Feb 10 2023", "Sat Feb 11 2023", "Thu Feb 16 2023", "Fri Feb 17 2023", "Sat Feb 18 2023", "Wed Feb 22 2023", "Thu Feb 23 2023", "Fri Feb 24 2023", "Sat Feb 25 2023", "Thu Mar 02 2023", "Fri Mar 03 2023", "Sat Mar 04 2023", "Thu Mar 09 2023", "Fri Mar 10 2023", "Sat Mar 11 2023", "Thu Mar 16 2023", "Fri Mar 17 2023", "Sat Mar 18 2023", "Thu Mar 23 2023", "Sat Mar 25 2023", "Thu Mar 30 2023", "Fri Mar 31 2023", "Fri Mar 24 2023"];
    const blockBlobClient = openSavedStateBlob(blobClient);

    if (!(await blockBlobClient.exists())) {
        context.log.warn("Saved state blob does not exist in Azure Storage. Assuming there are no known dates.");
        return new Set();
    }

    const downloadBuffer = await blockBlobClient.download();

    if (!downloadBuffer.readableStreamBody) {
        throw "No stream body returned.";
    }

    let state: SavedState|null|undefined = JSON.parse((await streamToBuffer(downloadBuffer.readableStreamBody)).toString());

    if (!state) {
        state = {
            knownDates: []
        };
    }

    return new Set(state.knownDates.map(x => new Date(x).toDateString()));
}

async function persistKnownDates(context: Context, blobClient: BlobServiceClient, knownDates: Set<string>) {
    context.log(`Persisting ${knownDates.size} known dates: ` + Array.from(knownDates.values()).map(x => `"${x}"`).join(", "));
    const blockBlobClient = openSavedStateBlob(blobClient);

    const json: SavedState = {
        knownDates: Array.from(knownDates.values())
    };

    await blockBlobClient.uploadData(Buffer.from(JSON.stringify(json)));
}

function openSavedStateBlob(blobClient: BlobServiceClient): BlockBlobClient {
    const containerName = process.env.WatchDonnaStorageContainerName;
    const blobName = process.env.WatchDonnaStorageBlobName;

    if (!containerName) {
        throw "WatchDonnaStorageContainerName is not defined.";
    }

    if (!blobName) {
        throw "WatchDonnaStorageBlobName is not defined";
    }

    return blobClient.getContainerClient(containerName).getBlockBlobClient(blobName);
}

// A helper method used to read a Node.js readable stream into a Buffer
function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (data) => {
        chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
      });
      stream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      stream.on("error", reject);
    });
  }