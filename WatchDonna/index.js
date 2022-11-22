import got from "got";

function fetchKnownDates() {
    const knownDateStrings = ["Nov 23,2022","Nov 25,2022","Nov 26,2022","Nov 30,2022","Dec 01,2022","Dec 02,2022","Dec 03,2022","Dec 07,2022","Dec 08,2022","Dec 09,2022","Dec 10,2022","Dec 12,2022","Dec 14,2022","Dec 15,2022","Dec 16,2022","Dec 17,2022","Dec 19,2022","Dec 20,2022","Dec 28,2022","Dec 29,2022","Dec 30,2022","Dec 31,2022"];
    return new Set(knownDateStrings.map(Date.parse));
}

function persistKnownDates(context, knownDates) {
    context.log(`Persisting ${knownDates.length} known dates: ` + Array.from(newDates.values()).join(", "));
}

export default async function (context, myTimer) {
    context.log('Script start: Checking whether Donna has posted any new dates of service.', new Date());

    if (myTimer.isPastDue)
    {
        context.log('Warning: isPastDue is set to true.');
    }

    const knownDates = fetchKnownDates();

    const requestBody = {
        "businessID":"213133",
        "spID":""
    };

    const response = await got.post("https://www.vagaro.com/us02/websiteapi/homepage/getavailabledates", { json: requestBody }).json();
    const responseDates = response.d.map(Date.parse);

    context.log(`Received ${responseDates.length} dates from Vagaro. Checking for new entries...`);

    newDates = responseDates.filter(x => knownDates.has(x));

    if (newDates.length === 0) {
        context.log('Did not find any new dates of service.');
        return;
    }

    context.log(`Found new dates of service: ${Array.from(newDates.values()).join(", ")}`);

    // Construct a new list of known dates, dropping any dates in the past and adding any new ones we discovered.
    const now = new Date();
    const newKnownDates = new Set([
        ...Array.from(knownDates).filter(x => x.after(now)), // Include previously known dates, dropping dates in the past.
        ...newDates.values() // Include any newly discovered dates.
    ]);

    persistKnownDates(newKnownDates);
};