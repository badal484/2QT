const authKey = '524621TvewiLzS6a5add22P1';
const templateId = '6a5ae4478f489f578300d262';
const phone = '916204646300';

async function testSMS() {
    console.log("Test 1: JSON body with 'OTP' uppercase only");
    const res1 = await fetch('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authkey': authKey },
        body: JSON.stringify({ template_id: templateId, mobile: phone, OTP: "111111" })
    });
    console.log("Test 1 Response:", await res1.json());
    
    // Wait 5s
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log("Test 2: query string otp, body OTP");
    const res2 = await fetch(`https://control.msg91.com/api/v5/otp?otp=222222&template_id=${templateId}&mobile=${phone}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authkey': authKey },
        body: JSON.stringify({ OTP: "222222" })
    });
    console.log("Test 2 Response:", await res2.json());
}
testSMS();
