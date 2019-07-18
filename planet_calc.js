const VARIABLE_TYPE = {
	GIVEN: 1,
	DERIVED: 2,
	ASSUMED: 3,
	UNKNOWN: 4
};

const VALUE_TYPE = {
	FINITE: 3,
	CONSTRAINED_RANGE: 2,
	UNCONSTRAINED_RANGE: 1
};

Object.filter = (obj, predicate) =>
	Object.keys(obj)
		.filter( key => predicate(obj[key]) )
		.reduce( (res, key) => (res[key] = obj[key], res), {} );

function getValueTypeFromValue(value){
	if(!Array.isArray(value)){
		return VALUE_TYPE.FINITE;
	}
	if(value[0] === -Infinity && value[1] === Infinity){
		return VALUE_TYPE.UNCONSTRAINED_RANGE;
	}
	return VALUE_TYPE.CONSTRAINED_RANGE;
}

function removeDuplicates (list){
	return [...new Set(list)];
}

function getValueRange(variable){
	return Math.abs(variable.value[1]-variable.value[0])
}

class VariableBag{
	constructor(){
		this.variables = {}
	}
	addVariable(variable){
		if(variable.name in this.variables)
			throw `Variable ${variable.name} already exists in Variable Bag, exiting.`;	//Prefer to exit instead of overwriting a variable
		this.variables[variable.name] = variable;
	}
	containsVariable(variableName){
		return variableName in this.variables;
	}
}

class Variable{
	constructor(type, unit, name) { //TODO modify to allow for a single argument that can be destructured for initial values
		this.value = [-Infinity, Infinity];
		this.type = type;
		this.valueType = VALUE_TYPE.UNCONSTRAINED_RANGE;
		this.unit = unit;
		this.name = name;
	}

	updateValue(newValueType, newValue){
		if(this.valueType === VALUE_TYPE.FINITE)
			throw "Value is already finite. Update is invalid";

		switch(newValueType){
			case VALUE_TYPE.UNCONSTRAINED_RANGE:
				throw "New value is unconstrained. Update is invalid";
			case VALUE_TYPE.FINITE:
				this.valueType = VALUE_TYPE.FINITE;
				this.value = newValue;
				return true;
			case VALUE_TYPE.CONSTRAINED_RANGE:
				this.valueType = VALUE_TYPE.CONSTRAINED_RANGE;
				let oldValue = [...this.value];
				this.value[0] = Math.max(this.value[0], newValue[0]);
				this.value[1] = Math.min(this.value[1], newValue[1]);
				return oldValue[0] !== this.value[0] || oldValue[1] !== this.value[1];
		}
	}
}

class Equation{
	//TODO Modify this to specify assumed units for variables contained in the variable manifest
	constructor(variables, forms, name){
		this.variables = variables;
		this.forms = forms;
		this.name = name;
	}
	applies(variableBag){
		/*
		* Accepts:
		*   variablebag: the variable bag
		* Returns:
		*   boolean
		*
		* Compare variable manifest with bag
		* Applies if bag contains all variables in manifest or all variables but one
		* */

		let nonUnconstrainedVariables = Object.filter(variableBag.variables, x=> x.valueType !== VALUE_TYPE.UNCONSTRAINED_RANGE);
		let diffSet = this.variables.filter(x => !(x in nonUnconstrainedVariables));
		let hasEnoughVariables = diffSet.length <=1;
		console.log(`Equation ${this.name} differs by [${diffSet}] and ${hasEnoughVariables?'has enough variables':"doesn't have enough variables"}`);
		//TODO check to make sure computable variables are not already finite
		let atLeastOneVariableNonFinite = true;
		return hasEnoughVariables && atLeastOneVariableNonFinite;
	}
	chooseForm(variableBag){
		/*
		* Accepts:
		*   variableBag: the variable bag
		* Returns:
		*   {target, form}
		* If one variable not present in bag, choose form that yields that variable
		* If all variables are present, pick via VALUE_TYPE hierarchy
		* 	if minimal value type is unconstrained, just pick the first one
		*	if minimal value type is constrained take the one with the lowest numerical range TODO this is not perfect considering unit mismatches, but it'll have to do for now
		*	if minimal value type is finite, throw an error
		* If all match, return null;
		* */
		//TODO returning a reference to self is not idea
		let diffSet = this.variables.filter(x => !(x in variableBag.variables));
		if(diffSet.length === 0){
			let variables = Object.values(variableBag.variables).filter(x => this.variables.includes(x.name));
			variables.sort((x,y) => x.valueType - y.valueType);
			switch(variables[0].valueType){
				case VALUE_TYPE.FINITE:
					throw Error(`In Equation.chooseForm: Value type is FINITE, this function fails its precondition`);
				case VALUE_TYPE.UNCONSTRAINED_RANGE:
					return {
						target: variables[0].name,
						form: this.forms[variables[0].name],
						equation: this
					};
				case VALUE_TYPE.CONSTRAINED_RANGE:
					variables.sort((a,b)=> getValueRange(a) - getValueRange(b));
					return {
						target: variables[0].name,
						form: this.forms[variables[0].name],
						equation: this
					}
			}
		}else if(diffSet.length === 1){
			if(!this.forms[diffSet[0]]){
				throw Error(`Equation ${this.name} has no form for ${diffSet[0]}`)
			}
			return {target: diffSet[0], form: this.forms[diffSet[0]], equation: this};
		}else{
			throw Error(`Diff set is too large to continue (Equation.chooseForm) ${this.name}, ${this.variables}`)
		}
	}
	compute(form, variableBag){ //TODO this uses no instance variables and doesn't need to be a class variable
		/*
		* for each finite variable, insert into the set
		* for each constrained variable, copy each set and set the min as the value in one and the max as the value in the other
		* run the equation for each set, storing the value for each
		* if only 1 set, update that value as finite
		* if multiple sets, update the value as a constrained range using the [Min of all values, max of all values]
		* TODO this algorithm will not work if equation's most extreme values occur at values in the middle of the input ranges
		* */
		let sets = [{}];
		let nonUnconstrainedVariables = Object.filter(variableBag.variables, x=> x.valueType !== VALUE_TYPE.UNCONSTRAINED_RANGE);
		//for(let variable of Object.values(variableBag.variables)){
		for(let variable of Object.values(nonUnconstrainedVariables)){
			switch(variable.valueType) {
				case VALUE_TYPE.FINITE:
					sets.forEach(el => el[variable.name] = variable.value);
					break;
				case VALUE_TYPE.CONSTRAINED_RANGE:
					let setForkA = JSON.parse(JSON.stringify(sets));
					setForkA.forEach(el => el[variable.name] = variable.value[0]);
					let setForkB = JSON.parse(JSON.stringify(sets));
					setForkB.forEach(el => el[variable.name] = variable.value[1]);
					sets = [...setForkA, ...setForkB];
					break;
				case VALUE_TYPE.UNCONSTRAINED_RANGE:
					throw  "A variable with an unconstrained range value type was passed to Equation.compute. Cannot continue"+variable;
			}
		}

		let results = [];
		for(let variableSet of sets){
			results.push(form(variableSet))
		}
		results = removeDuplicates(results); //exclude duplicates
		let resultMin = results.reduce((agg, el) => Math.min(agg, el), results[0]); //get the minimum of all results
		let resultMax = results.reduce((agg, el) => Math.max(agg, el), results[0]); //get the maximum of all results
		if(resultMin === resultMax){
			return resultMin;	//value converged, return as a finite value
		}
		return [resultMin, resultMax];	//return the widest bounds of values
	}
}

let myEquations = {
	//TODO having both a key and a name property is over-definition
	sphericalDensity: new Equation(["radius", "mass", "density"],{
		density: ({mass, radius})=> mass / (4/3 * Math.PI * Math.pow(radius,3)),
		radius: ({density, mass}) => Math.cbrt( mass / density * 3/4 / Math.PI ),
		mass: ({density, radius}) => (Math.PI * 4 / 3 * Math.pow(radius, 3)) / density
	}, "sphericalDensity"),
	acc_g_surface: new Equation(["acc_g", "mass", "radius"], {
		acc_g: ({mass, radius}) => (GRAVITATIONAL_CONSTANT*mass/Math.pow(radius, 2))/EARTH_ACCg,
		mass: ({acc_g, radius}) => (EARTH_ACCg*acc_g*Math.pow(radius, 2))/(6.67408 * Math.pow(10, -11)),
		radius: ({acc_g, mass}) => Math.sqrt(GRAVITATIONAL_CONSTANT*mass/(acc_g*EARTH_ACCg))
	}, "accelerationGsAtSurface"),
	orbital_velocity_from_sun_mass: new Equation(["sun_mass", "orbital_velocity", "orbital_radius"], {
		orbital_velocity: ({sun_mass, orbital_radius}) => Math.sqrt(GRAVITATIONAL_CONSTANT * sun_mass / orbital_radius),
		orbital_radius: ({sun_mass, orbital_velocity})=> GRAVITATIONAL_CONSTANT * sun_mass / Math.pow(orbital_velocity, 2),
		sun_mass: ({orbital_velocity, orbital_radius}) => Math.pow(orbital_velocity, 2) * orbital_radius / GRAVITATIONAL_CONSTANT
	}, "orbitalVelocityFromSunMass"),
	orbital_velocity_from_period: new Equation(["orbital_velocity", "orbital_period", "orbital_radius"],{
		orbital_velocity: ({orbital_period, orbital_radius}) => 2 * Math.PI * orbital_radius / (orbital_period * SECONDS_PER_DAY),
		orbital_period: ({orbital_velocity, orbital_radius}) => (2 * Math.PI * orbital_radius / orbital_velocity) / SECONDS_PER_DAY,
		orbital_radius: ({orbital_velocity, orbital_period}) => orbital_velocity * orbital_period * SECONDS_PER_DAY / (2 * Math.PI)
	}, "orbitalVelocityFromPeriod")
};

function computeCycle(){
	let excludedEquations = [];
	let keepGoing;
	let cycleCount = 1;
	do{
		keepGoing = true;
		let viableEquations = [];
		for(let equationName in myEquations){
			if(equationName in excludedEquations){
				continue;
			}
			if(myEquations[equationName].applies(myBag)){
				viableEquations.push(equationName);
			}
		}
		if(!viableEquations.length){
			keepGoing = false;
		}
		let chosenForms = viableEquations.map(equationName => myEquations[equationName].chooseForm(myBag));
		//TODO sort by bag value type hierarchy?
		let computeResults = chosenForms.map(el=> {
			return {...el, target: el.target, value: el.equation.compute(el.form, myBag)}
		});
		computeResults = computeResults.map(el => {
			return {...el, valueType: getValueTypeFromValue(el.value)}
		});
		let valuesUpdated = computeResults.map(el => {
			if(myBag.containsVariable(el.target)){
				return {...el, updated: myBag.variables[el.target].updateValue(el.valueType, el.value)}
			}else{
				myBag.addVariable(new Variable(VARIABLE_TYPE.DERIVED,"unknown", el.target));
				return {...el, updated: myBag.variables[el.target].updateValue(el.valueType, el.value)}
			}
		});
		//for each that did not produce an update, add it to the list of excluded equations
		let notUpdated = valuesUpdated.filter(el => !el.updated);
		notUpdated.forEach(el=>{
			console.log(`Adding ${el.equation.name} to list of excluded equations`);
			excludedEquations.push(el.equation.name);
		});
		if(valuesUpdated.every(el => !el.updated)){
			console.log("No updates occurred, exiting early");
			keepGoing = false;
		}
		//sort viable equations by value type hierarchy and execute
		//if no value update, add equation to the excludedEquations list
		console.log(`Cycle ${cycleCount} completed`);
		cycleCount++;
	}while(keepGoing && cycleCount < 10);
	console.log(myBag.variables);
}

const GRAVITATIONAL_CONSTANT = 6.67408 * Math.pow(10, -11);
const EARTH_ACCg = 9.8;
const SECONDS_PER_DAY = 24*60*60;
const SECONDS_PER_YEAR = 365.25*SECONDS_PER_DAY;


let myBag = new VariableBag();
myBag.addVariable(new Variable(VARIABLE_TYPE.GIVEN, "m", "radius"));
myBag.addVariable(new Variable(VARIABLE_TYPE.GIVEN, "g", "acc_g"));
myBag.addVariable(new Variable(VARIABLE_TYPE.UNKNOWN, "kg", "mass"));
myBag.addVariable(new Variable(VARIABLE_TYPE.UNKNOWN, "kg/m^3", "density"));
myBag.addVariable(new Variable(VARIABLE_TYPE.UNKNOWN, "kg", "sun_mass"));
myBag.addVariable(new Variable(VARIABLE_TYPE.UNKNOWN, "m/s", "orbital_velocity"));
myBag.addVariable(new Variable(VARIABLE_TYPE.UNKNOWN, "m", "orbital_radius"));
myBag.addVariable(new Variable(VARIABLE_TYPE.UNKNOWN, "days", "orbital_period"));
myBag.variables["radius"].updateValue(VALUE_TYPE.CONSTRAINED_RANGE, [6370000, 6371000]);
myBag.variables["acc_g"].updateValue(VALUE_TYPE.CONSTRAINED_RANGE, [.99, 1.01]);
myBag.variables["orbital_radius"].updateValue(VALUE_TYPE.CONSTRAINED_RANGE, [149600000000, 149700000000]);
myBag.variables["orbital_period"].updateValue(VALUE_TYPE.CONSTRAINED_RANGE, [365, 366]);
//computeCycle();