#What is this thing?
I wanted to make an engine you could plug equations into and it reduces infinite plausible ranges down into constrained plausible ranges and possibly into finite values.

It's named Planetary Calculator because the initial use case (and reason for creating this) is to be able to "build" a planet by specifying a minimal amount of information and letting the set of equations tell you everything else that can be gleaned from what you provided. For instance, the density of a planet can be determined by its elemental composition or by things known about its radius and orbit.

Possible use cases are for worldbuilding (pun slightly intended) or for plugging in minimal exoplanet data and getting an idea for what the planet might be like.

Under the hood, this is just a slightly naiive approach to solving a system of equations by tightening constraints on the system. The use case changes easily by swapping out the equations.

The system is currently only set up to run with numerical data. It is possible that this could be extended to also deal  with things like booleans, but that'll have to come later.

## Object types
### Variable Bag
Contains a bag of all variables for the object

### Variable
#### Types
* Given
* Derived
* Assumed

Derived variables should contain a list of "sources" which will map to equations

#### Value Types
Has a value type:

* Unconstrained Range (-inf, inf)
* Constrained Range (someX, someY)
* Finite (X)

##### Value Type Hierarchy
First by value type
* Finite
* Constrained Range
* Unconstrained Range

Constrained ranges have a hierarchy inverse to the "size" of their ranges, so smaller ranges are more "correct"

#### Unit
Has a unit. Standard SI units should be used if possible.

#### Name

Variables should have a unique name not shared by any other variable in the bag

### Equation
#### Manifest
Equations should have a manifest specifying what variables it contains and a unique name.
#### Documentation
Should be specified in comments in its most recognizable form in the comments

Possibly specify a web link if pulled from an obscure source

Units should be specified in comments whenever possible

#### Behavior
##### Applicability test
Equation should be applied if:
* the bag contains all variables listed in the equation manifest or all but one
* no more than one variable is an "unconstrained range"

The equation should attempt to solve for the lowest variable in the value type hierarchy.

* If the lowest in the hierarchy is a given, pick the next lowest.
* If the lowest in the hierarchy is derived and the source is from this equation, pick the next lowest.
* If after both of the above rules have been applied there are no remaining canidates, the equation does not apply.

##### Method of calculation
1. Pick the form of the equation that yields the target variable
2. For each variable that is
* finite, use the value directly for all calculations
* constrained range, do one calculation for the min of the range and one for the max of the range
* unconstrained range, if you're here you should have failed the applicability test
3. For N constrained range variables, we should have 2^N possible solutions
4. If any of the variables are constrained ranges, the result constrained range is min(individual results),max(individual results)
5. If none of the variables are constrained ranges, the answer is finite.
6. If a range has the same min and max value, convert it to a finite value instead.
7. Update the target variable

If a range result has the

* If the target is finite and the result is a range, you did something wrong
* If the target is a range and the result is finite
  * If the range does not intersect with the result
    * Target is derived -> calculation failure
    * Target is assumed -> replace target's value with result and upgrade it to "derived", notify user of an "assumption failure"
  * If the range does intersect with the result -> update the value with the finite result and set the variable to "derived"
* If both the target and the result are a range
  * If the range does not intersect with the result
    * Target is derived -> calculation failure
    * Target is assumed -> replace target's value with result and upgrade it to "derived", notify user of an "assumption failure"
  * If the target fully overlaps or is fully overlapped by the result
    * Set target to the smallest of the two ranges.
      * If the result was the smallest range, set the source to the equation
      * If the target had the smallest range, leave the source what it was, note on the cycle to exclude this variable from the list of valid targets for that equation for the rest of the cycle.
  * If the target partially overlaps with the result
    * New range is (max(targetMin, resultMin), min(targetMax, resultMax)
    * If source is a
      * string identifying an equation, convert it to a list with both equations in it
      * list with more than one string, add the new source to the list
8. If the updated variable is a range with the same min and max, convert it to a finite value.

###### Possible improvements

Realistically, if the range source is an intersection of 3 sources, there might be more constraining that could be done if we were to rerun the other source equations with the updated information.

Possibly take samples in the middle of the range? This could help with multimodal equations.


##### Calculation Failure
A calculation failure occurs if the target variable is given or derived and does not intersect with the result value.

If this is the case, notify the user and cease calculation.

## Workflow
User will start with a blank set of variables in their bag.

User may pick a set of assumptions to kick start the calculations. This kicks off the process in "adding a variable"

### Adding a variable
Each time the user changes a variable, clear any restricted variable-equation pairs and start a calculation cycle.

### Removing a variable (Unfinished)
The user can un-set any givens or assumptions in their bag. This clears any derived values from the bag and kicks off the calculation cycle again.

### Calculation Cycle
Check each equation for viability. Do not begin calculations until all have been checked.

If there are no viable equations, we're done.

Otherwise, for each viable equation, order the targets by hierarchy.

Perform the equations in the order of their hierarchy.

Equations which cause a calculation failure do not update the target variable and immediately stop the calculation cycle.

Equations which fail to update a variable (usually because of a reselected target or a double overlapping range) are tagged with an exclusion for that variable.

After all equations have been run, start another calculation cycle. We will keep rechecking the calculation cycle until there are no viable equations.

