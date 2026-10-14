import {it,expect} from "vitest";
import {Vector3} from "three";
import {modelYaw,characterYaw} from "../src/render/facing";
it.each([0,Math.PI/2,-Math.PI/2,Math.PI])("model faces the mouse aim direction at yaw %s",yaw=>{
 const actual=new Vector3(0,0,-1).applyAxisAngle(new Vector3(0,1,0),modelYaw(yaw));expect(actual.x).toBeCloseTo(Math.sin(yaw),6);expect(actual.z).toBeCloseTo(-Math.cos(yaw),6);
});
it("local character turns immediately with mouse look while remote yaw remains authoritative",()=>{expect(characterYaw(1,1,.8,.2)).toBe(.8);expect(characterYaw(2,1,.8,.2)).toBe(.2);});
