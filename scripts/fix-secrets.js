const { spawn } = require('child_process');

async function setSecret(name, value) {
    return new Promise((resolve, reject) => {
        const child = spawn('firebase', ['functions:secrets:set', name], { shell: true });

        child.stdin.write(value);
        child.stdin.end();

        let output = '';
        child.stdout.on('data', (data) => output += data);
        child.stderr.on('data', (data) => output += data);

        child.on('close', (code) => {
            if (code === 0) resolve(output);
            else reject(new Error(`Failed with code ${code}: ${output}`));
        });
    });
}

async function run() {
    try {
        console.log('Setting Key ID...');
        await setSecret('RAZORPAY_KEY_ID', 'rzp_live_S4UFro656NZEhB');
        console.log('✅ Key ID set');

        console.log('Setting Key Secret...');
        await setSecret('RAZORPAY_KEY_SECRET', 'uUJrjs8cJrraGbixq2rFKq1H');
        console.log('✅ Key Secret set');

        console.log('\nNow run: firebase deploy --only functions');
    } catch (e) {
        console.error(e);
    }
}

run();
