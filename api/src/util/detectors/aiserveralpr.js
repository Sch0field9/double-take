const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const actions = require('./actions');
const { DETECTORS } = require('../../constants')();
const config = require('../../constants/config');

const { AISERVERALPR } = DETECTORS || {};

module.exports.recognize = async ({ key }) => {
  const { URL } = AISERVERALPR;
  const formData = new FormData();
  formData.append('image', fs.createReadStream(key));

  return axios({
    method: 'post',
    timeout: AISERVERALPR.TIMEOUT * 1000,
    headers: {
      ...formData.getHeaders(),
    },
    url: `${URL}/v1/image/alpr`,
    validateStatus() {
      return true;
    },
    data: formData,
  });
};

module.exports.train = ({ name, key }) => {
return true;
};

module.exports.remove = ({ name }) => {
return true;
};

module.exports.normalize = ({ camera, data }) => {
  if (!data.success) {
    // compare with CoderProjectAI sources
    // https://github.com/codeproject/CodeProject.AI-Server/blob/main/src/modules/FaceProcessing/intelligencelayer/face.py#L528
    if (data.code === 500 && data.error === 'No face found in image') {
      console.log('ai.server found no face in image');
      return [];
    }
    console.warn('unexpected ai.server data');
    return [];
  }
  const { MATCH, UNKNOWN } = config.detect(camera);
  if (!data.predictions) {
    console.warn('unexpected ai.server predictions data');
    return [];
  }
  const normalized = data.predictions.flatMap((obj) => {
    const confidence = parseFloat((obj.confidence * 100).toFixed(2));
    obj.userid = obj.userid ? obj.userid : obj.plate ? obj.plate : 'unknown';
    const output = {
      name: confidence >= UNKNOWN.CONFIDENCE ? obj.userid.toLowerCase() : 'unknown',
      confidence,
      match:
        obj.userid !== 'unknown' &&
        confidence >= MATCH.CONFIDENCE &&
        (obj.x_max - obj.x_min) * (obj.y_max - obj.y_min) >= MATCH.MIN_AREA,
      box: {
        top: obj.y_min,
        left: obj.x_min,
        width: obj.x_max - obj.x_min,
        height: obj.y_max - obj.y_min,
      },
    };
    const checks = actions.checks({ MATCH, UNKNOWN, ...output });
    if (checks.length) output.checks = checks;
    return checks !== false ? output : [];
  });
  return normalized;
};
