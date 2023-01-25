import got from "got";

function fetchKnownDates() {
    // const knownDateStrings = ["Nov 23,2022","Nov 25,2022","Nov 26,2022","Nov 30,2022","Dec 01,2022","Dec 02,2022","Dec 03,2022","Dec 07,2022","Dec 08,2022","Dec 09,2022","Dec 10,2022","Dec 12,2022","Dec 14,2022","Dec 15,2022","Dec 16,2022","Dec 17,2022","Dec 19,2022","Dec 20,2022","Dec 28,2022","Dec 29,2022","Dec 30,2022","Dec 31,2022"];
    const knownDateStrings = ["1/25/2023", "1/26/2023", "1/27/2023", "1/28/2023", "2/1/2023", "2/2/2023", "2/3/2023", "2/4/2023", "2/9/2023", "2/10/2023", "2/11/2023", "2/16/2023", "2/17/2023", "2/18/2023", "2/22/2023", "2/23/2023", "2/24/2023", "2/25/2023", "3/2/2023", "3/3/2023", "3/4/2023", "3/9/2023", "3/10/2023", "3/11/2023", "3/16/2023", "3/17/2023", "3/18/2023", "3/23/2023", "3/24/2023", "3/25/2023", "3/30/2023", "3/31/2023"];
    return new Set(knownDateStrings.map(x => new Date(x)));
}

function persistKnownDates(context, knownDates) {
    context.log(`Persisting ${knownDates.size} known dates: ` + Array.from(knownDates.values()).map(x => `"${x.toLocaleDateString()}"`).join(", "));
}

export default async function (context, myTimer) {
    context.log('Script start: Checking whether Donna has posted any new dates of service.', new Date());

    if (myTimer.isPastDue) {
        context.log('Warning: isPastDue is set to true.');
    }

    const knownDates = fetchKnownDates();

    const requestBody = {
        "businessID":"213133",
        "spID":""
    };

    const response = await got.post("https://www.vagaro.com/us02/websiteapi/homepage/getavailabledates", { json: requestBody }).json();
    const responseDates = response.d.map(x => new Date(x));

    context.log(`Received ${responseDates.length} dates from Vagaro. Checking for new entries...`);

    const newDates = responseDates.filter(x =>
        !knownDates.has(x));

    if (newDates.length === 0) {
        context.log('Did not find any new dates of service.');
        return;
    }

    newDates.forEach(x => {
        context.log(`Found new date of service: ${x.toLocaleDateString()}`); 
    });

    // Construct a new list of known dates, dropping any dates in the past and adding any new ones we discovered.
    const now = new Date();
    const newKnownDates = new Set([
        ...Array.from(knownDates).filter(x => x && now < x), // Include previously known dates, dropping dates in the past.
        ...newDates.values() // Include any newly discovered dates.
    ]);

    persistKnownDates(context, newKnownDates);
};