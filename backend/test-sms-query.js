const authKey = '524621TvewiLzS6a5add22P1';
const templateId = '6a5ae4478f489f578300d262';
const phone = '916204646300';

async function testSMS() {
    console.log("Test 4: Pure Query String without JSON body");
    const url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${phone}&otp=555555`;
    const res1 = await fetch(url, {
        method: 'POST',
        headers: { 'authkey': authKey }
    });
    console.log("Test 4 Response:", await res1.json());
}
testSMS();
