import got from "got";

function fetchKnownDates() {
    const knownDateStrings = ["Wed Jan 25 2023", "Thu Jan 26 2023", "Fri Jan 27 2023", "Sat Jan 28 2023", "Wed Feb 01 2023", "Thu Feb 02 2023", "Fri Feb 03 2023", "Sat Feb 04 2023", "Thu Feb 09 2023", "Fri Feb 10 2023", "Sat Feb 11 2023", "Thu Feb 16 2023", "Fri Feb 17 2023", "Sat Feb 18 2023", "Wed Feb 22 2023", "Thu Feb 23 2023", "Fri Feb 24 2023", "Sat Feb 25 2023", "Thu Mar 02 2023", "Fri Mar 03 2023", "Sat Mar 04 2023", "Thu Mar 09 2023", "Fri Mar 10 2023", "Sat Mar 11 2023", "Thu Mar 16 2023", "Fri Mar 17 2023", "Sat Mar 18 2023", "Thu Mar 23 2023", "Sat Mar 25 2023", "Thu Mar 30 2023", "Fri Mar 31 2023", "Fri Mar 24 2023"];
    return new Set(knownDateStrings.map(x => new Date(x).toDateString()));
}

function persistKnownDates(context, knownDates) {
    context.log(`Persisting ${knownDates.size} known dates: ` + Array.from(knownDates.values()).map(x => `"${x}"`).join(", "));
}

export default async function (context, myTimer) {
    const now = new Date();
    context.log('Script start: Checking whether Donna has posted any new dates of service.', now);

    if (myTimer.isPastDue) {
        context.log('Warning: isPastDue is set to true.');
    }

    const knownDates = fetchKnownDates();

    const requestBody = {
        "businessID":"213133",
        "spID":""
    };

    const response = await got.post("https://www.vagaro.com/us02/websiteapi/homepage/getavailabledates", { json: requestBody }).json();
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

    persistKnownDates(context, newKnownDates);
};