import { describe, expect, expectTypeOf, it } from "vitest";
import result, { err, none, ok, some, type Option, type Result } from ".";

//###########################################################################################################################################################
//      _____  ______  _____ _    _ _   _______    ____  _  __
//     |  __ \|  ____|/ ____| |  | | | |__   __|  / __ \| |/ /
//     | |__) | |__  | (___ | |  | | |    | |    | |  | | ' /
//     |  _  /|  __|  \___ \| |  | | |    | |    | |  | |  <
//     | | \ \| |____ ____) | |__| | |____| |    | |__| | . \
//     |_|  \_\______|_____/ \____/|______|_|     \____/|_|\_\
//###########################################################################################################################################################
describe("Result Ok", function () {
  it("Value from valid result", function () {
    const result = ok(42);
    expect(result.value).equal(42);
  });
  it("ok from valid result", function () {
    const result = ok(42);
    expect(result.ok).equal(true);
  });
  it("err from valid result", function () {
    const result = ok(42);
    expect(result.err).equal(false);
  });
  it("expect value from valid result", function () {
    const result = ok(42);
    expect(result.expect()).equal(42);
  });
  it("expect_err value from valid result", function () {
    const result = ok(42);
    expect(() => {
      result.expect_err("YOYO");
    }).to.throw();
  });
  it("unwrap value from valid result", function () {
    const result = ok(42);
    expect(result.unwrap()).equal(42);
  });
  it("unwrap_or value from valid result", function () {
    const result = ok(42);
    expect(result.unwrap_or()).equal(42);
  });
  it("unwrap_err from valid result with default value", function () {
    const result = ok(42);
    let yo;
    expect(() => {
      yo = result.unwrap_err();
    }).to.throw();
    yo = yo;
  });
  it("unwrap_err_or from valid result with default value", function () {
    const result = ok(42);
    expect(result.unwrap_err_or(43)).equal(43);
  });

  it("and_then from valid result returning valid result", function () {
    const result = ok(42);
    expect(
      result
        .and_then((val) => {
          expect(val).equal(42);
          return ok("42");
        })
        .expect(),
    ).equal("42");
  });
  it("and_then from valid result returning error result", function () {
    const result = ok(42);
    expect(
      result
        .and_then((val) => {
          expect(val).equal(42);
          return err("42");
        })
        .expect_err(),
    ).equal("42");
  });
  it("or_else from valid result", function () {
    const result = ok(42);
    expect(result.or_else().expect()).equal(42);
  });
  it("map from valid result", function () {
    const result = ok(42);
    expect(
      result
        .map((val) => {
          expect(val).equal(42);
          return "42";
        })
        .expect(),
    ).equal("42");
  });
  it("map_err from valid result", function () {
    const result = ok(42);
    expect(result.map_err().expect()).equal(42);
  });
  it("compare equal valid results", function () {
    const result1 = ok(42);
    const result2 = ok(42);
    expect(result1.compare(result2)).equal(true);
  });
  it("compare unequal valid results", function () {
    const result1 = ok(42);
    const result2 = ok(43);
    expect(result1.compare(result2)).equal(false);
  });
  it("compare valid and error results", function () {
    const result1 = ok(42) as Result<number, string>;
    const result2 = err("42") as Result<number, string>;
    expect(result1.compare(result2)).equal(false);
  });

  it("to_option from valid result", function () {
    const result = ok(42);
    expect(result.to_option().expect()).equal(42);
  });
});

//###########################################################################################################################################################
//      _____  ______  _____ _    _ _   _______   ______ _____  _____   ____  _____
//     |  __ \|  ____|/ ____| |  | | | |__   __| |  ____|  __ \|  __ \ / __ \|  __ \
//     | |__) | |__  | (___ | |  | | |    | |    | |__  | |__) | |__) | |  | | |__) |
//     |  _  /|  __|  \___ \| |  | | |    | |    |  __| |  _  /|  _  /| |  | |  _  /
//     | | \ \| |____ ____) | |__| | |____| |    | |____| | \ \| | \ \| |__| | | \ \
//     |_|  \_\______|_____/ \____/|______|_|    |______|_|  \_\_|  \_\\____/|_|  \_\
//###########################################################################################################################################################
describe("Result Error", function () {
  it("value from error result", function () {
    const result = err(42);
    expect(result.error).equal(42);
  });
  it("valid from error result", function () {
    const result = err(42);
    expect(result.valid).equal(false);
  });
  it("ok from error result", function () {
    const result = err(42);
    expect(result.ok).equal(false);
  });
  it("err from error result", function () {
    const result = err(42);
    expect(result.err).equal(true);
  });
  it("expect_err value from error result", function () {
    const result = err(42);
    expect(result.expect_err()).equal(42);
  });
  it("unwrap value from error result", function () {
    const result = err(42);
    let yo;
    expect(() => {
      yo = result.unwrap();
    }).to.throw();
    yo = yo;
  });
  it("unwrap_or value from error result", function () {
    const result = err(42);
    expect(result.unwrap_or(42)).equal(42);
  });
  it("unwrap_err from error result", function () {
    const result = err("42");
    expect(result.unwrap_err()).equal("42");
  });
  it("unwrap_err_or from error result", function () {
    const result = err("42");
    expect(result.unwrap_err_or()).equal("42");
  });

  it("and_then from error result", function () {
    const result = err(42);
    expect(result.and_then().expect_err()).equal(42);
  });
  it("or_else from error result", function () {
    const result = err(42);
    expect(
      result
        .or_else((val) => {
          expect(val).equal(42);
          return ok("42");
        })
        .expect(),
    ).equal("42");
  });
  it("map from error result", function () {
    const result = err(42);
    expect(result.map().expect_err()).equal(42);
  });
  it("map_err from error result", function () {
    const result = err(42);
    expect(
      result
        .map_err((val) => {
          expect(val).equal(42);
          return "42";
        })
        .expect_err(),
    ).equal("42");
  });
  it("compare equal error results", function () {
    const result1 = err(42);
    const result2 = err(42);
    expect(result1.compare(result2)).equal(true);
  });
  it("compare unequal error results", function () {
    const result1 = err(42);
    const result2 = err(43);
    expect(result1.compare(result2)).equal(false);
  });
  it("compare error and valid results", function () {
    const result1 = err(42) as Result<number, number>;
    const result2 = ok(42) as Result<number, number>;
    expect(result1.compare(result2)).equal(false);
  });
  it("to_option from error result", function () {
    const result = err(42);
    expect(result.to_option().none).equal(true);
  });
});
//###########################################################################################################################################################
//       ____  _____ _______ _____ ____  _   _    _____  ____  __  __ ______
//      / __ \|  __ \__   __|_   _/ __ \| \ | |  / ____|/ __ \|  \/  |  ____|
//     | |  | | |__) | | |    | || |  | |  \| | | (___ | |  | | \  / | |__
//     | |  | |  ___/  | |    | || |  | | . ` |  \___ \| |  | | |\/| |  __|
//     | |__| | |      | |   _| || |__| | |\  |  ____) | |__| | |  | | |____
//      \____/|_|      |_|  |_____\____/|_| \_| |_____/ \____/|_|  |_|______|
//###########################################################################################################################################################
describe("Option Some", function () {
  it("value from Some", function () {
    const result = some(42);
    expect(result.value).equal(42);
  });
  it("some from Some", function () {
    const result = some(42);
    expect(result.some).equal(true);
  });
  it("none from Some", function () {
    const result = some(42);
    expect(result.none).equal(false);
  });
  it("expect from Some", function () {
    const result = some(42);
    expect(result.expect()).equal(42);
  });
  it("unwrap from Some", function () {
    const result = some(42);
    expect(result.unwrap()).equal(42);
  });
  it("unwrap_or from Some", function () {
    const result = some(42);
    expect(result.unwrap_or()).equal(42);
  });
  it("and_then from Some returning Some", function () {
    const result = some(42);
    expect(
      result
        .and_then((val) => {
          expect(val).equal(42);
          return some("42");
        })
        .expect(),
    ).equal("42");
  });
  it("and_then from Some returning error result", function () {
    const result = some(42);
    expect(
      result.and_then((val) => {
        expect(val).equal(42);
        return none();
      }).none,
    ).equal(true);
  });
  it("or_else from Some", function () {
    const result = some(42);
    expect(result.or_else().expect()).equal(42);
  });
  it("map from Some", function () {
    const result = some(42);
    expect(
      result
        .map((val) => {
          expect(val).equal(42);
          return "42";
        })
        .expect(),
    ).equal("42");
  });
  it("compare equal Some", function () {
    const result1 = some(42);
    const result2 = some(42);
    expect(result1.compare(result2)).equal(true);
  });
  it("compare unequal Some", function () {
    const result1 = some(42);
    const result2 = some(43);
    expect(result1.compare(result2)).equal(false);
  });
  it("compare Some and None", function () {
    const result1 = some(42);
    const result2 = none();
    expect(result1.compare(result2)).equal(false);
  });
  it("to_result from Some", function () {
    const result = some(42);
    expect(result.to_result().expect()).equal(42);
  });
});

//###########################################################################################################################################################
//       ____  _____ _______ _____ ____  _   _   _   _  ____  _   _ ______
//      / __ \|  __ \__   __|_   _/ __ \| \ | | | \ | |/ __ \| \ | |  ____|
//     | |  | | |__) | | |    | || |  | |  \| | |  \| | |  | |  \| | |__
//     | |  | |  ___/  | |    | || |  | | . ` | | . ` | |  | | . ` |  __|
//     | |__| | |      | |   _| || |__| | |\  | | |\  | |__| | |\  | |____
//      \____/|_|      |_|  |_____\____/|_| \_| |_| \_|\____/|_| \_|______|
//###########################################################################################################################################################
describe("Option None", function () {
  it("some from None", function () {
    const result = none();
    expect(result.some).equal(false);
  });
  it("none from None", function () {
    const result = none();
    expect(result.none).equal(true);
  });
  it("expect from None", function () {
    const result = none();
    expect(() => {
      result.expect("YOYO");
    }).to.throw();
  });
  it("unwrap from None", function () {
    const result = none();
    let yo;
    expect(() => {
      yo = result.unwrap();
    }).to.throw();
    yo = yo;
  });
  it("unwrap_or from None", function () {
    const result = none();
    expect(result.unwrap_or(42)).equal(42);
  });
  it("and_then from None returning error result", function () {
    const result = none();
    expect(result.and_then().none).equal(true);
  });
  it("or_else from Some returning Some", function () {
    const result = none();
    expect(
      result
        .or_else(() => {
          return some("42");
        })
        .expect(),
    ).equal("42");
  });
  it("or_else from Some returning error result", function () {
    const result = none();
    expect(
      result.or_else(() => {
        return none();
      }).none,
    ).equal(true);
  });
  it("map from None", function () {
    const result = none();
    expect(result.map()).equal(result);
  });
  it("compare equal None", function () {
    const result1 = none();
    const result2 = none();
    expect(result1.compare(result2)).equal(true);
  });
  it("compare Some and None", function () {
    const result1 = some(42);
    const result2 = none();
    expect(result1.compare(result2)).equal(false);
  });
  it("to_result from None", function () {
    const result = none();
    expect(result.to_result("YOYO").err).equal(true);
  });
});

//###########################################################################################################################################################
//       ____  _____ _______ _____ ____  _   _   _   _          _____  _____   ______          _______ _   _  _____
//      / __ \|  __ \__   __|_   _/ __ \| \ | | | \ | |   /\   |  __ \|  __ \ / __ \ \        / /_   _| \ | |/ ____|
//     | |  | | |__) | | |    | || |  | |  \| | |  \| |  /  \  | |__) | |__) | |  | \ \  /\  / /  | | |  \| | |  __
//     | |  | |  ___/  | |    | || |  | | . ` | | . ` | / /\ \ |  _  /|  _  /| |  | |\ \/  \/ /   | | | . ` | | |_ |
//     | |__| | |      | |   _| || |__| | |\  | | |\  |/ ____ \| | \ \| | \ \| |__| | \  /\  /   _| |_| |\  | |__| |
//      \____/|_|      |_|  |_____\____/|_| \_| |_| \_/_/    \_\_|  \_\_|  \_\\____/   \/  \/   |_____|_| \_|\_____|
//###########################################################################################################################################################
describe("Option", function () {
  it("Type narrowing", function () {
    const result = ((): Option<boolean> => {
      return none();
    })();
    expectTypeOf(result).toEqualTypeOf<Option<boolean>>();
    if (result.some) {
      expectTypeOf(result.value).toEqualTypeOf<boolean>();
    }
  });
});

//###########################################################################################################################################################
//      _____  ______  _____ _    _ _   _______   _   _          _____  _____   ______          _______ _   _  _____
//     |  __ \|  ____|/ ____| |  | | | |__   __| | \ | |   /\   |  __ \|  __ \ / __ \ \        / /_   _| \ | |/ ____|
//     | |__) | |__  | (___ | |  | | |    | |    |  \| |  /  \  | |__) | |__) | |  | \ \  /\  / /  | | |  \| | |  __
//     |  _  /|  __|  \___ \| |  | | |    | |    | . ` | / /\ \ |  _  /|  _  /| |  | |\ \/  \/ /   | | | . ` | | |_ |
//     | | \ \| |____ ____) | |__| | |____| |    | |\  |/ ____ \| | \ \| | \ \| |__| | \  /\  /   _| |_| |\  | |__| |
//     |_|  \_\______|_____/ \____/|______|_|    |_| \_/_/    \_\_|  \_\_|  \_\\____/   \/  \/   |_____|_| \_|\_____|
//###########################################################################################################################################################
describe("Result", function () {
  it("Type narrowing", function () {
    const result = ((): Result<boolean, string> => {
      return err("YOYO");
    })();
    expectTypeOf(result).toEqualTypeOf<Result<boolean, string>>();
    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<boolean>();
    } else {
      expectTypeOf(result.error).toEqualTypeOf<string>();
    }
  });
});

//###########################################################################################################################################################
//      _    _ ______ _      _____  ______ _____
//     | |  | |  ____| |    |  __ \|  ____|  __ \
//     | |__| | |__  | |    | |__) | |__  | |__) |
//     |  __  |  __| | |    |  ___/|  __| |  _  /
//     | |  | | |____| |____| |    | |____| | \ \
//     |_|  |_|______|______|_|    |______|_|  \_\
//###########################################################################################################################################################
describe("Helpers", function () {
  it("Is result", function () {
    expect(result.is_result(err("YOYO"))).equal(true);
    expect(result.is_result(ok(42))).equal(true);
    expect(result.is_result({})).equal(false);
    expect(result.is_result({ ok: true, value: 42 })).equal(false);
    expect(result.is_result(40)).equal(false);
  });
  it("Is option", function () {
    expect(result.is_option(some(42))).equal(true);
    expect(result.is_option(none())).equal(true);
    expect(result.is_option({})).equal(false);
    expect(result.is_option({ some: true, value: 42 })).equal(false);
    expect(result.is_option(40)).equal(false);
  });
});
