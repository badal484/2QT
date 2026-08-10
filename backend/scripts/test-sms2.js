const authKey = '524621TvewiLzS6a5add22P1';
const templateId = '6a5ae4478f489f578300d262';
const phone = '916204646300';

async function testSMS() {
    console.log("Test 3: The payload that worked at 16:45, but let's see if we can pass variables inside an 'extra' object?");
    const res1 = await fetch('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authkey': authKey },
        body: JSON.stringify({ template_id: templateId, mobile: phone, otp: "333333" })
    });
    console.log("Test 3 Response:", await res1.json());
}
testSMS();
