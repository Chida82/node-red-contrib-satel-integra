var Color = require('../src/cli.js');

describe("A suite", function() {
    it("contains spec with an expectation", function() {
      var a = new Color(["7E"]);
      expect(true).toBe(true);
    });
  });