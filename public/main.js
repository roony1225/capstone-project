const ipUrl = '192.168.45.125:9000';

window.onload = () => {
    axios.get(`https://${ipUrl}/resetVariable`);
}