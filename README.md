<p align="center">
  <img src="https://github.com/furmly/furmly-studio/blob/master/logo-grey.png" width="135" align="center">
  <br>
  <br>
</p>
# Furmly-core

This is the core abstraction of furmly. It is divided in the following main concepts.

* Process
* Step
* Processor
* Form/Elements
* Async Processors
  
## Process

A process like the name implies is represents everything needed for a user to complete a set of steps. It has a number of predefined steps. Rules:-
*  A process is a sequence of steps an actor or actors take to achieve a business goal.

*  A process must be uniquely identifiable system wide.

*  There can be several steps in a process but there must be atleast one step.
  
*  A process can describe its required steps.

* A process can be returned to when not completed.
  
* Processess are created with a unique id,title,description and steps. 

## Step
 A step like the name implies is a task the user must complete to proceed towards the final goal. There are two types of steps namely:-
 1) Client:- these steps present an interface the user can interact with. All client type steps contain forms.
 2) Offline:- these steps don't have an interface. They could be used to start offline tasks.
   
Steps also have two distinct modes:-
1) default:- steps in this mode require a processing after a user submits a form.
2) view:- steps in this mode do not require any processing, i.e a user cannot submit this kind of step/form.

Rules:-
*  Steps can either involve collecting input from a user or from another system generated event.

*  A step must be uniquely identifiable within a process.

*  Steps can have a chain of processors but the chain must have atleast one. 

*  Steps can have a chain of post processors but no minimum is required. 

*  Steps requiring user input must contain a form. 
  
*  Steps are created with id ,type and processors. 

*  A step can describe its form and processors. 
   
*  Client Steps require a form. 

*  A form can describe its elements properties and validators. 


## Processors

Processors are snippets of code that contain business logic used to process several tasks during the lifecycle of a process. When steps are completed and submitted ,processors are responsible for processing the user input.

* Processors can modify the regular flow of steps. 

* Processors are uniquely identifiable system wide. 

* Processors can create entities

* Processors can edit entities. 

* Processors can delete entities. 


## Elements/Form

A form is a collection of elements presented to a user. Elements describe the type of information required by the form/step. Elements can contain other elements.
* A form must contain atleast one element.

* An element can contain any number of validators. 

* Validators can either run on the clients machine or externally.






